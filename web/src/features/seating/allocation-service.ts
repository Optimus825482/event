import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, reservations } from "@/db/schema";
import type { TableAllocation } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { insertNotification, type NotificationRow } from "@/features/notifications/service";
import { publish } from "@/features/realtime/publish";
import { ACTIVE_STATUSES, lockEvent } from "@/features/reservations/internal";
import { DomainError } from "@/lib/action";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { buildReleaseNotification } from "./notify";
import { actorName } from "@/features/planning/stage-service";
import { getSaleSettings } from "./settings-service";
import { removeSeatSlots, syncSeatSlots } from "./slots";

type AllocationRequest = { eventId: string; tableIds: string[] };
export type SaleTarget = Extract<TableAllocation, "online" | "pending" | "closed">;

type LockedTable = { id: string; label: string; allocation: TableAllocation; isLoca: boolean };

const MSG = {
  eventNotFound: "Etkinlik bulunamadı",
  eventClosed: "Tamamlanmış veya iptal edilmiş etkinlikte masa tahsisi değiştirilemez",
  tableNotFound: "Masa bu etkinlikte bulunamadı",
  notPending: "Yalnızca beklemedeki masalar Casino'ya ayrılabilir",
  notCasino: "Yalnızca Casino'ya ayrılmış masalar serbest bırakılabilir",
  hasReservation: "Etkin rezervasyonu olan masalar serbest bırakılamaz",
  casinoLocked: "Casino'ya ayrılmış masaların satış durumu değiştirilemez",
  locaClosed: "Localar bu etkinlikte online satışa kapalı",
} as const;

const byLabel = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });

function conflictWith(message: string, tables: { label: string }[]): DomainError {
  const labels = tables
    .map((t) => t.label)
    .sort(byLabel)
    .join(", ");
  return new DomainError("conflict", `${message}: ${labels}`);
}

/**
 * Ortak kilit adımı: etkinlik `FOR SHARE` → durum denetimi → masalar kimlik sırasıyla `FOR UPDATE`.
 * İstenen masalardan biri bu etkinlikte yoksa `not_found`.
 */
async function lockForAllocation(tx: Tx, actor: Actor, input: AllocationRequest) {
  const event = await lockEvent(tx, actor, input.eventId, MSG.eventNotFound);
  if (event.status === "completed" || event.status === "cancelled") {
    throw new DomainError("conflict", MSG.eventClosed);
  }
  const ids = [...new Set(input.tableIds)];
  const tables: LockedTable[] = await tx
    .select({
      id: eventTables.id,
      label: eventTables.label,
      allocation: eventTables.allocation,
      isLoca: eventTables.isLoca,
    })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, input.eventId), inArray(eventTables.id, ids)))
    .orderBy(asc(eventTables.id))
    .for("update");
  if (tables.length !== ids.length) throw new DomainError("not_found", MSG.tableNotFound);
  return { event, tables };
}

async function setAllocation(tx: Tx, tableIds: string[], allocation: TableAllocation): Promise<void> {
  if (tableIds.length === 0) return;
  await tx.update(eventTables).set({ allocation }).where(inArray(eventTables.id, tableIds));
}

/** Toplu işlem tek olay yayar; yalnızca tek masa değiştiyse olay masa kimliğini taşır. */
async function publishChange(tx: Tx, eventId: string, changedIds: string[]): Promise<void> {
  if (changedIds.length === 0) return;
  const only = changedIds.length === 1 ? changedIds[0] : undefined;
  await publish(tx, { type: "allocation.changed", eventId, ...(only ? { id: only } : {}) });
}

/** Beklemedeki masaları Casino'ya ayırır (atomik: uymayan tek masa tüm isteği reddeder). */
export async function allocateToCasino(db: Db, actor: Actor, input: AllocationRequest): Promise<{ updated: number }> {
  authorize(actor, "reservations", "edit");

  return db.transaction(async (tx) => {
    const { tables } = await lockForAllocation(tx, actor, input);
    const invalid = tables.filter((t) => t.allocation !== "pending");
    if (invalid.length > 0) throw conflictWith(MSG.notPending, invalid);

    const ids = tables.map((t) => t.id);
    await setAllocation(tx, ids, "casino");
    await publishChange(tx, input.eventId, ids);
    return { updated: ids.length };
  });
}

/**
 * Casino masalarını beklemeye geri verir ve Entertainment'a bildirim yazar. Etkin rezervasyon
 * masa kilidi alındıktan sonra okunur; eşzamanlı rezervasyon masayı `FOR SHARE` kilitlediğinden
 * ya önce biter (burada görülür) ya da bu işlemin ardından yabancı anahtara takılır.
 * Bildirim satırı döner; yayını işlem bittikten sonra çağıran yapar.
 */
export async function releaseFromCasino(
  db: Db,
  actor: Actor,
  input: AllocationRequest,
): Promise<{ updated: number; notification: NotificationRow | null }> {
  authorize(actor, "reservations", "edit");

  try {
    return await db.transaction(async (tx) => {
      const { event, tables } = await lockForAllocation(tx, actor, input);
      const invalid = tables.filter((t) => t.allocation !== "casino");
      if (invalid.length > 0) throw conflictWith(MSG.notCasino, invalid);

      const ids = tables.map((t) => t.id);
      const active = await tx
        .selectDistinct({ tableId: reservations.tableId })
        .from(reservations)
        .where(
          and(
            eq(reservations.eventId, input.eventId),
            inArray(reservations.tableId, ids),
            inArray(reservations.status, [...ACTIVE_STATUSES]),
          ),
        );
      if (active.length > 0) {
        const busy = new Set(active.map((r) => r.tableId));
        throw conflictWith(
          MSG.hasReservation,
          tables.filter((t) => busy.has(t.id)),
        );
      }

      await setAllocation(tx, ids, "pending");
      const notification =
        ids.length === 0
          ? null
          : await insertNotification(
              tx,
              buildReleaseNotification({
                event: { id: event.id, name: event.name },
                actorId: actor.id,
                actorName: await actorName(tx, actor),
                tables: tables.map((t) => ({ id: t.id, label: t.label })),
              }),
            );
      await publishChange(tx, input.eventId, ids);
      return { updated: ids.length, notification };
    });
  } catch (error) {
    // Son savunma hattı: etkin rezervasyonlu masanın tahsisini veritabanı da değiştirtmez.
    if (pgCodeOf(error) === "23503" && pgConstraintOf(error) === "reservations_casino_table_fk") {
      throw new DomainError("conflict", MSG.hasReservation);
    }
    throw error;
  }
}

/**
 * Satış tahsisi: `pending`/`online`/`closed` arasında her yönde (atomik). Casino masasına dokunulmaz;
 * loca, satış ayarı izin vermiyorsa online yapılamaz. Yazma sırası: online'dan çıkanların yuvaları
 * silinir → tahsis güncellenir → online'a girenlerin yuvaları eşitlenir.
 */
export async function setSaleAllocation(
  db: Db,
  actor: Actor,
  input: AllocationRequest & { allocation: SaleTarget },
): Promise<{ updated: number }> {
  authorize(actor, "ticketing", "edit");

  return db.transaction(async (tx) => {
    const { tables } = await lockForAllocation(tx, actor, input);
    const casino = tables.filter((t) => t.allocation === "casino");
    if (casino.length > 0) throw conflictWith(MSG.casinoLocked, casino);

    if (input.allocation === "online") {
      const locas = tables.filter((t) => t.isLoca);
      if (locas.length > 0 && !(await getSaleSettings(tx, input.eventId)).locaOnline) {
        throw conflictWith(MSG.locaClosed, locas);
      }
    }

    const changed = tables.filter((t) => t.allocation !== input.allocation);
    const leavingOnline = changed.filter((t) => t.allocation === "online").map((t) => t.id);
    const ids = changed.map((t) => t.id);

    await removeSeatSlots(tx, input.eventId, leavingOnline);
    await setAllocation(tx, ids, input.allocation);
    if (input.allocation === "online") await syncSeatSlots(tx, input.eventId, ids);

    await publishChange(tx, input.eventId, ids);
    return { updated: ids.length };
  });
}
