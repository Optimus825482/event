import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventExtraStaffTables,
  eventTables,
  events,
  reservations,
  tableGroupTables,
  tableTypes,
  tickets,
} from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { listEventTables, totalCapacity, type EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import { byLabel } from "@/lib/compare";
import { pgCodeOf } from "@/lib/pg-error";
import { syncBarServicePoints } from "./service-points-sync";
import { MAX_FLOOR, MAX_TABLE_CAPACITY, MAX_TABLES, MIN_FLOOR, decorSchema, normalizeLabel, type Decor, type DecorInput, type TableInput } from "./schemas";

export type EventTableRow = typeof eventTables.$inferSelect;

export const EVENT_NOT_FOUND = "Etkinlik bulunamadı";

export function isLayoutEditable(event: Pick<EventRow, "status">): boolean {
  return event.status !== "completed" && event.status !== "cancelled";
}

/** Etkinlik satırını `FOR UPDATE` ile kilitler; erişim ve düzenlenebilirlik denetlenir. */
export async function lockEditableEvent(tx: Tx, actor: Actor, eventId: string): Promise<EventRow> {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
  if (!event) throw new DomainError("not_found", EVENT_NOT_FOUND);
  if (!isLayoutEditable(event)) {
    throw new DomainError("conflict", "Tamamlanmış veya iptal edilmiş etkinliğin yerleşimi değiştirilemez");
  }
  return event;
}

/**
 * Verilen masalardan "kullanımda" olanların kimlikleri: herhangi bir durumdaki rezervasyon,
 * personel ataması, ek personel ya da masa grubu üyeliği.
 */
export async function tablesInUse(tx: Db | Tx, eventId: string, tableIds: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  if (tableIds.length === 0) return used;
  const sources = [reservations, assignmentTables, tableGroupTables, eventExtraStaffTables] as const;
  for (const source of sources) {
    const rows = await tx
      .selectDistinct({ tableId: source.tableId })
      .from(source)
      .where(and(eq(source.eventId, eventId), inArray(source.tableId, tableIds)));
    for (const row of rows) used.add(row.tableId);
  }
  return used;
}

/** Bileti olmuş (süresi dolan dahil) masalar: `tickets_event_table_fk` RESTRICT silmeyi engeller. */
async function tablesWithTickets(tx: Db | Tx, eventId: string, tableIds: string[]): Promise<Set<string>> {
  if (tableIds.length === 0) return new Set();
  const rows = await tx
    .selectDistinct({ tableId: tickets.tableId })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventId), inArray(tickets.tableId, tableIds)));
  return new Set(rows.map((row) => row.tableId));
}

type NormalizedTable = {
  id: string | undefined;
  label: string;
  capacity: number;
  tableTypeId: string | null;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
  isVip: boolean;
  isPinned: boolean;
  size: number | null;
  floor: number;
  sortNumber: number | null;
};

function normalizeRotation(value: number): number {
  const r = ((value % 360) + 360) % 360;
  return Math.round(r * 1000) / 1000;
}

function quoteList(labels: string[]): string {
  return labels.map((l) => `"${l}"`).join(", ");
}

/** İş kuralları: etiket tekil (büyük/küçük harf duyarsız), kapasite 1..MAX, masa sayısı sınırı. */
function normalizeTables(tables: TableInput[]): NormalizedTable[] {
  if (tables.length > MAX_TABLES) throw new DomainError("conflict", `En fazla ${MAX_TABLES} masa olabilir`);
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  const badCapacity: string[] = [];
  const badFloor: string[] = [];
  const emptyLabel = tables.some((t) => t.label.trim() === "");
  if (emptyLabel) throw new DomainError("conflict", "Her masanın bir etiketi olmalı");
  // Tekrarlanan kimlik, yerleşim kilidini atlatabilir (kilit yalnızca son girdiyi görür); şemadan bağımsız reddedilir.
  const ids = tables.flatMap((t) => (t.id ? [t.id] : []));
  if (new Set(ids).size !== ids.length) throw new DomainError("conflict", "Masa iki kez gönderildi");

  const result = tables.map((t) => {
    const label = t.label.trim();
    const key = normalizeLabel(label);
    if (seen.has(key)) duplicates.add(seen.get(key) ?? label);
    else seen.set(key, label);
    if (!Number.isInteger(t.capacity) || t.capacity < 1 || t.capacity > MAX_TABLE_CAPACITY) badCapacity.push(label);
    if (t.floor !== undefined && (!Number.isInteger(t.floor) || t.floor < MIN_FLOOR || t.floor > MAX_FLOOR)) badFloor.push(label);
    return {
      id: t.id,
      label,
      capacity: t.capacity,
      tableTypeId: t.tableTypeId ?? null,
      x: t.x,
      y: t.y,
      rotation: normalizeRotation(t.rotation ?? 0),
      isLoca: t.isLoca ?? false,
      isVip: t.isVip ?? false,
      isPinned: t.isPinned ?? false,
      size: t.size ?? null,
      floor: t.floor ?? MIN_FLOOR,
      sortNumber: t.sortNumber ?? null,
    };
  });
  if (duplicates.size > 0) {
    throw new DomainError("conflict", `Masa etiketi etkinlik içinde tekil olmalı: ${quoteList([...duplicates])}`);
  }
  if (badCapacity.length > 0) {
    throw new DomainError(
      "conflict",
      `Kapasite 1 ile ${MAX_TABLE_CAPACITY} arasında bir tam sayı olmalı: ${quoteList(badCapacity)}`,
    );
  }
  if (badFloor.length > 0) {
    throw new DomainError("conflict", `Kat ${MIN_FLOOR} ile ${MAX_FLOOR} arasında bir tam sayı olmalı: ${quoteList(badFloor)}`);
  }
  return result;
}

function normalizeDecor(decor: DecorInput): Decor {
  const parsed = decorSchema.safeParse(decor);
  if (!parsed.success) throw new DomainError("conflict", "Yerleşim öğeleri (sahne, duvar, alan) geçersiz");
  return parsed.data;
}

async function assertTableTypesExist(tx: Tx, tables: NormalizedTable[]): Promise<void> {
  const ids = [...new Set(tables.map((t) => t.tableTypeId).filter((id): id is string => id !== null))];
  if (ids.length === 0) return;
  const found = await tx.select({ id: tableTypes.id }).from(tableTypes).where(inArray(tableTypes.id, ids));
  if (found.length !== ids.length) throw new DomainError("not_found", "Masa tipi bulunamadı");
}

function valuesRow(t: NormalizedTable & { id: string }) {
  return sql`(${t.id}::uuid, ${t.label}::text, ${t.capacity}::int, ${t.tableTypeId}::uuid, ${t.x}::float8, ${t.y}::float8, ${t.rotation}::float8, ${t.isLoca}::boolean, ${t.isVip}::boolean, ${t.isPinned}::boolean, ${t.size}::float8, ${t.floor}::smallint, ${t.sortNumber}::int)`;
}

/**
 * Aktif (bekleyen/onaylı/girişli) rezervasyonun kişi sayısının altına kapasite indirilemez.
 * Etkinlik satırı çağıran tarafından `FOR UPDATE` kilitli olduğundan eşzamanlı rezervasyon yazılamaz.
 */
async function assertCapacityCoversReservations(
  tx: Tx,
  eventId: string,
  updates: Array<NormalizedTable & { id: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  const active = await tx
    .select({ tableId: reservations.tableId, guests: sql<number>`max(${reservations.guestCount})::int` })
    .from(reservations)
    .where(
      and(
        eq(reservations.eventId, eventId),
        inArray(reservations.status, ["pending", "confirmed", "checked_in"]),
        inArray(
          reservations.tableId,
          updates.map((t) => t.id),
        ),
      ),
    )
    .groupBy(reservations.tableId);
  const needed = new Map(active.map((row) => [row.tableId, row.guests]));
  const tooSmall = updates.filter((t) => t.capacity < (needed.get(t.id) ?? 0)).map((t) => t.label).sort();
  if (tooSmall.length > 0) {
    throw new DomainError(
      "conflict",
      `Aktif rezervasyonu olan masaların kapasitesi rezervasyondaki kişi sayısının altına düşürülemez: ${quoteList(tooSmall)}. Hiçbir değişiklik kaydedilmedi.`,
    );
  }
}

/** Bir masa masa grubundayken loca bayrağı değişemez (loca grubu yalnızca loca masalarını içerir). */
async function assertGroupedLocaFlagsUnchanged(
  tx: Tx,
  eventId: string,
  updates: Array<NormalizedTable & { id: string }>,
  existingById: Map<string, { isLoca: boolean }>,
): Promise<void> {
  const flipped = updates.filter((t) => existingById.get(t.id)?.isLoca !== t.isLoca);
  if (flipped.length === 0) return;
  const grouped = await tx
    .select({ tableId: tableGroupTables.tableId })
    .from(tableGroupTables)
    .where(
      and(
        eq(tableGroupTables.eventId, eventId),
        inArray(
          tableGroupTables.tableId,
          flipped.map((t) => t.id),
        ),
      ),
    );
  if (grouped.length === 0) return;
  const inGroup = new Set(grouped.map((r) => r.tableId));
  const labels = flipped.filter((t) => inGroup.has(t.id)).map((t) => t.label).sort();
  throw new DomainError(
    "conflict",
    `Gruptaki masanın loca durumu değiştirilemez; önce masayı gruptan çıkarın: ${labels.join(", ")}`,
  );
}

export type WriteLayoutResult = {
  tables: EventTableRow[];
  totalCapacity: number;
  decor: Decor;
  /** Kayıttan sonra kullanımda olan (silinemeyen) masalar. */
  lockedTableIds: string[];
};

/**
 * Yerleşimi transaction içinde yazar (çağıran, etkinliği önceden kilitlemiş olmalı).
 * Kimliği olan girdiler güncellenir, kimliksizler eklenir, girdide olmayan mevcut satırlar silinir.
 * Kullanımdaki bir masa silinmek istenirse hiçbir şey yazılmadan `conflict` fırlatılır.
 */
export async function writeLayout(
  tx: Tx,
  eventId: string,
  rawTables: TableInput[],
  rawDecor: DecorInput,
): Promise<WriteLayoutResult> {
  const tables = normalizeTables(rawTables);
  const decor = normalizeDecor(rawDecor);

  const existing = await tx
    .select({ id: eventTables.id, label: eventTables.label, capacity: eventTables.capacity, isLoca: eventTables.isLoca })
    .from(eventTables)
    .where(eq(eventTables.eventId, eventId));
  const existingById = new Map(existing.map((row) => [row.id, row]));

  const updates = tables.filter((t): t is NormalizedTable & { id: string } => t.id !== undefined);
  if (updates.some((t) => !existingById.has(t.id))) {
    throw new DomainError("not_found", "Masa bu etkinlikte bulunamadı");
  }
  const keep = new Set(updates.map((t) => t.id));
  const removed = existing.filter((row) => !keep.has(row.id));

  const used = await tablesInUse(
    tx,
    eventId,
    removed.map((row) => row.id),
  );
  if (used.size > 0) {
    const labels = removed.filter((row) => used.has(row.id)).map((row) => row.label).sort();
    throw new DomainError(
      "conflict",
      `Rezervasyonu veya personel ataması olan masalar silinemez: ${quoteList(labels)}. Hiçbir değişiklik kaydedilmedi.`,
    );
  }
  const ticketed = await tablesWithTickets(
    tx,
    eventId,
    removed.map((row) => row.id),
  );
  if (ticketed.size > 0) {
    const labels = removed.filter((row) => ticketed.has(row.id)).map((row) => row.label).sort(byLabel);
    throw new DomainError(
      "conflict",
      `${labels.join(", ")} ${labels.length === 1 ? "masasının" : "masalarının"} bilet geçmişi var, silinemez`,
    );
  }
  await assertGroupedLocaFlagsUnchanged(tx, eventId, updates, existingById);
  await assertCapacityCoversReservations(tx, eventId, updates);
  await assertTableTypesExist(tx, tables);
  await syncBarServicePoints(tx, eventId, decor);

  if (removed.length > 0) {
    await tx.delete(eventTables).where(
      and(
        eq(eventTables.eventId, eventId),
        inArray(
          eventTables.id,
          removed.map((row) => row.id),
        ),
      ),
    );
  }

  if (updates.length > 0) {
    // Etiket takası (M1<->M2) tekillik kısıtına takılmasın: değişen etiketler önce geçici değere alınır.
    const renamed = updates.filter((t) => existingById.get(t.id)?.label !== t.label).map((t) => t.id);
    if (renamed.length > 0) {
      await tx
        .update(eventTables)
        .set({ label: sql`'~' || ${eventTables.id}::text` })
        .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, renamed)));
    }
    await tx.execute(sql`
      update ${eventTables} as t set
        label = v.label, capacity = v.capacity, table_type_id = v.table_type_id,
        x = v.x, y = v.y, rotation = v.rotation, is_loca = v.is_loca,
        sellable_seats = CASE WHEN t.sellable_seats IS NULL THEN NULL ELSE least(t.sellable_seats, v.capacity) END,
        is_vip = v.is_vip, is_pinned = v.is_pinned, size = v.size, floor = v.floor, sort_number = v.sort_number,
        updated_at = now()
      from (values ${sql.join(updates.map(valuesRow), sql`, `)})
        as v(id, label, capacity, table_type_id, x, y, rotation, is_loca, is_vip, is_pinned, size, floor, sort_number)
      where t.id = v.id and t.event_id = ${eventId}`);
  }

  const inserts = tables.filter((t) => t.id === undefined);
  if (inserts.length > 0) {
    await tx.insert(eventTables).values(
      inserts.map((t) => ({
        eventId,
        label: t.label,
        capacity: t.capacity,
        tableTypeId: t.tableTypeId,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        isLoca: t.isLoca,
        isVip: t.isVip,
        isPinned: t.isPinned,
        size: t.size,
        floor: t.floor,
        sortNumber: t.sortNumber,
      })),
    );
  }

  const capacity = await totalCapacity(tx, eventId);
  await tx
    .update(events)
    .set({ layoutDecor: decor, totalCapacity: capacity, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  const saved = await listEventTables(tx, eventId);
  const locked = await tablesInUse(
    tx,
    eventId,
    saved.map((t) => t.id),
  );
  return {
    tables: saved,
    totalCapacity: capacity,
    decor,
    lockedTableIds: saved.filter((t) => locked.has(t.id)).map((t) => t.id),
  };
}

/** Transaction dışına çıkan PostgreSQL hatalarını anlamlı `DomainError`'a çevirir. */
export function mapLayoutDbError(error: unknown): never {
  const code = pgCodeOf(error);
  if (code === "23505") throw new DomainError("conflict", "Masa etiketi etkinlik içinde tekil olmalı");
  if (code === "23503") {
    throw new DomainError("conflict", "Masa başka kayıtlarca kullanılıyor; hiçbir değişiklik kaydedilmedi");
  }
  if (code === "23514") throw new DomainError("conflict", "Masa bilgileri geçersiz (kapasite en az 1, kat 1-9 olmalı)");
  throw error;
}

