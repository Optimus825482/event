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
} from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { listEventTables, totalCapacity, type EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import { pgCodeOf } from "@/lib/pg-error";
import { MAX_TABLE_CAPACITY, MAX_TABLES, decorSchema, normalizeLabel, type Decor, type DecorInput, type TableInput } from "./schemas";

export type EventTableRow = typeof eventTables.$inferSelect;

export const EVENT_NOT_FOUND = "Etkinlik bulunamadı";

/** Etkinlikler modülüyle aynı kural: organizatör yalnızca kendi etkinliğini görür, başkasınınki "yok"tur. */
export function assertEventAccess(actor: Actor, event: EventRow): void {
  if (!canAccessEvent(actor, event)) throw new DomainError("not_found", EVENT_NOT_FOUND);
}

export function isLayoutEditable(event: Pick<EventRow, "status">): boolean {
  return event.status !== "completed" && event.status !== "cancelled";
}

/** Etkinlik satırını `FOR UPDATE` ile kilitler; erişim ve düzenlenebilirlik denetlenir. */
export async function lockEditableEvent(tx: Tx, actor: Actor, eventId: string): Promise<EventRow> {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
  if (!event) throw new DomainError("not_found", EVENT_NOT_FOUND);
  assertEventAccess(actor, event);
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

type NormalizedTable = {
  id: string | undefined;
  label: string;
  capacity: number;
  tableTypeId: string | null;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
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
  const emptyLabel = tables.some((t) => t.label.trim() === "");
  if (emptyLabel) throw new DomainError("conflict", "Her masanın bir etiketi olmalı");

  const result = tables.map((t) => {
    const label = t.label.trim();
    const key = normalizeLabel(label);
    if (seen.has(key)) duplicates.add(seen.get(key) ?? label);
    else seen.set(key, label);
    if (!Number.isInteger(t.capacity) || t.capacity < 1 || t.capacity > MAX_TABLE_CAPACITY) badCapacity.push(label);
    return {
      id: t.id,
      label,
      capacity: t.capacity,
      tableTypeId: t.tableTypeId ?? null,
      x: t.x,
      y: t.y,
      rotation: normalizeRotation(t.rotation ?? 0),
      isLoca: t.isLoca ?? false,
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
  return sql`(${t.id}::uuid, ${t.label}::text, ${t.capacity}::int, ${t.tableTypeId}::uuid, ${t.x}::float8, ${t.y}::float8, ${t.rotation}::float8, ${t.isLoca}::boolean)`;
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
    .select({ id: eventTables.id, label: eventTables.label, capacity: eventTables.capacity })
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
  await assertCapacityCoversReservations(tx, eventId, updates);
  await assertTableTypesExist(tx, tables);

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
        x = v.x, y = v.y, rotation = v.rotation, is_loca = v.is_loca, updated_at = now()
      from (values ${sql.join(updates.map(valuesRow), sql`, `)})
        as v(id, label, capacity, table_type_id, x, y, rotation, is_loca)
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
  if (code === "23514") throw new DomainError("conflict", "Masa bilgileri geçersiz (kapasite en az 1 olmalı)");
  throw error;
}

