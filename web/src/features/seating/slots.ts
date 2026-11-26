import { and, asc, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { eventTables, tableSeatSlots } from "@/db/schema";
import { effectiveSellable } from "@/domain/seating";
import { DomainError } from "@/lib/action";
import { pgCodeOf } from "@/lib/pg-error";

const byLabel = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });

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

/**
 * Kapsamdaki `online` masaların yuva sayısını `effectiveSellable`'a getirir. Masa satırları kimlik
 * sırasıyla `FOR UPDATE` kilitlenir (etkinlik kilidi çağıranındır). Eksikse en büyük numaradan devam
 * edilir, fazlaysa en büyük numaralardan silinir; `online` olmayan masaya dokunulmaz.
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

  const slots = await tx
    .select({ id: tableSeatSlots.id, tableId: tableSeatSlots.tableId, seatNo: tableSeatSlots.seatNo })
    .from(tableSeatSlots)
    .where(
      inArray(
        tableSeatSlots.tableId,
        tables.map((t) => t.id),
      ),
    )
    .orderBy(asc(tableSeatSlots.tableId), asc(tableSeatSlots.seatNo));

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
      const doomed = own.slice(target).map((s) => s.id);
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
