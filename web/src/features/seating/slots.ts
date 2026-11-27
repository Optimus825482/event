import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { eventTables, tableSeatSlots } from "@/db/schema";
import { effectiveSellable } from "@/domain/seating";
import { expireStaleHolds } from "@/features/ticketing/orders-service";
import { DomainError } from "@/lib/action";
import { byLabel } from "@/lib/compare";
import { pgCodeOf } from "@/lib/pg-error";

function cannotShrink(labels: string[]): DomainError {
  return new DomainError(
    "conflict",
    `Satılmış ya da tutulan sandalye sayısının altına inilemez: ${[...labels].sort(byLabel).join(", ")}`,
  );
}

/**
 * Yuva silmeyi kayıt noktası içinde dener: yabancı anahtar (23503) hatası işlemi bozmaz.
 * Silinebildiyse `true`, bilet satırlarınca referans alınıyorsa `false` döner.
 */
async function tryDeleteSlots(tx: Tx, slotIds: string[]): Promise<boolean> {
  try {
    await tx.transaction(async (sp) => {
      await sp.delete(tableSeatSlots).where(inArray(tableSeatSlots.id, slotIds));
    });
    return true;
  } catch (error) {
    if (pgCodeOf(error) === "23503") return false;
    throw error;
  }
}

/** Masaların yuvaları (masa, `seat_no` sırasıyla); `active`: yuvada etkin (`held`/`issued`) bilet var. */
async function readSlots(tx: Tx, tableIds: string[]) {
  return tx
    .select({
      id: tableSeatSlots.id,
      tableId: tableSeatSlots.tableId,
      seatNo: tableSeatSlots.seatNo,
      // Tam nitelikli ham SQL: seçim alanındaki alt sorguda Drizzle sütunları öneksiz yazar ("id" biletinkine çözülür).
      active: sql<boolean>`exists (select 1 from tickets t where t.seat_slot_id = "table_seat_slots"."id" and t.status in ('held', 'issued'))`,
    })
    .from(tableSeatSlots)
    .where(inArray(tableSeatSlots.tableId, tableIds))
    .orderBy(asc(tableSeatSlots.tableId), asc(tableSeatSlots.seatNo));
}

/**
 * Kapsamdaki `online` masaların yuva sayısını `effectiveSellable`'a getirir. Masa satırları kimlik
 * sırasıyla `FOR UPDATE` kilitlenir (etkinlik kilidi çağıranındır). Eksikse en büyük numaradan devam
 * edilir; fazlaysa önce süresi dolmuş tutmalar süpürülür, sonra etkin bileti olmayan yuvalardan en büyük
 * numaralılar silinir (kalanların numarası değişmez). Boş yuva yetmezse `conflict`. `online` olmayan
 * masaya dokunulmaz.
 */
export async function syncSeatSlots(tx: Tx, eventId: string, tableIds?: readonly string[]): Promise<void> {
  if (tableIds && tableIds.length === 0) return;
  const scope = tableIds ? [inArray(eventTables.id, [...tableIds])] : [];
  const tables = await tx
    .select({
      id: eventTables.id,
      label: eventTables.label,
      capacity: eventTables.capacity,
      sellableSeats: eventTables.sellableSeats,
    })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.allocation, "online"), ...scope))
    .orderBy(asc(eventTables.id))
    .for("update");
  if (tables.length === 0) return;

  const ids = tables.map((t) => t.id);
  let slots = await readSlots(tx, ids);
  const shrinking = tables.filter((t) => slots.filter((s) => s.tableId === t.id).length > effectiveSellable(t));
  // Süresi dolmuş tutmalar yuvayı hâlâ dolu gösterir: masa kilitleri tutulurken, silinecekleri seçmeden önce
  // süpür (kilit sırası: masalar → sipariş → bilet). Süpürme olduysa etkin bilet bayrakları yeniden okunur.
  if (shrinking.length > 0) {
    const swept = await expireStaleHolds(tx, { eventId, tableIds: shrinking.map((t) => t.id) });
    if (swept > 0) slots = await readSlots(tx, ids);
  }

  const blocked: string[] = [];
  for (const table of tables) {
    const own = slots.filter((s) => s.tableId === table.id);
    const target = effectiveSellable(table);
    if (own.length < target) {
      const last = own.at(-1)?.seatNo ?? 0;
      await tx.insert(tableSeatSlots).values(
        Array.from({ length: target - own.length }, (_, i) => ({
          eventId,
          tableId: table.id,
          seatNo: last + i + 1,
        })),
      );
    } else if (own.length > target) {
      // Yalnızca etkin bileti olmayan yuvalar, büyük numaradan küçüğe; kalanların numarası değişmez.
      const excess = own.length - target;
      const free = own.filter((s) => !s.active).reverse();
      if (free.length < excess) {
        blocked.push(table.label);
        continue;
      }
      const doomed = free.slice(0, excess).map((s) => s.id);
      if (!(await tryDeleteSlots(tx, doomed))) blocked.push(table.label);
    }
  }
  if (blocked.length > 0) throw cannotShrink(blocked);
}

/** Verilen masaların tüm yuvalarını siler; bilet satırlarınca kullanılıyorsa `conflict` verir. */
export async function removeSeatSlots(tx: Tx, eventId: string, tableIds: readonly string[]): Promise<void> {
  if (tableIds.length === 0) return;
  const tables = await tx
    .select({ id: eventTables.id, label: eventTables.label })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, [...tableIds])))
    .orderBy(asc(eventTables.id))
    .for("update");
  if (tables.length === 0) return;
  // Süresi dolmuş ama süpürülmemiş tutmalar yuvaları hâlâ bağlar: masa kilitleri altında önce süpür
  // (`syncSeatSlots` ile aynı kilit sırası: masalar → sipariş → bilet).
  await expireStaleHolds(tx, { eventId, tableIds: tables.map((t) => t.id) });

  const blocked: string[] = [];
  for (const table of tables) {
    const slots = await tx
      .select({ id: tableSeatSlots.id })
      .from(tableSeatSlots)
      .where(eq(tableSeatSlots.tableId, table.id));
    if (slots.length === 0) continue;
    if (!(await tryDeleteSlots(tx, slots.map((s) => s.id)))) blocked.push(table.label);
  }
  if (blocked.length > 0) throw cannotShrink(blocked);
}
