import { and, asc, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventStaffAssignments, eventTables, events, orders, reservations } from "@/db/schema";
import { canTransitionEvent } from "@/domain/event-status";
import { resolveArtist } from "@/features/artists/resolve";
import { mapArchiveWriteError } from "@/features/archive/errors";
import { archiveEvent } from "@/features/archive/snapshot";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { escapeLike } from "@/lib/identifiers";
import { EVENT_STATUS_LABELS } from "./labels";
import type {
  ChangeEventStatusInput,
  CreateEventInput,
  DeleteEventInput,
  ListEventsFilter,
  ReviewSettingsInput,
  UpdateEventInput,
} from "./schemas";

type Executor = Db | Tx;
export type EventRow = typeof events.$inferSelect;

const DEFAULT_PAGE_SIZE = 20;

const NOT_FOUND = "Etkinlik bulunamadı";

export async function getEventOrThrow(db: Executor, id: string): Promise<EventRow> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

export async function listEventTables(db: Executor, eventId: string) {
  return db.select().from(eventTables).where(eq(eventTables.eventId, eventId)).orderBy(asc(eventTables.label));
}

export async function totalCapacity(db: Executor, eventId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${eventTables.capacity}), 0)::int` })
    .from(eventTables)
    .where(eq(eventTables.eventId, eventId));
  return row?.total ?? 0;
}

export async function createEvent(db: Executor, actor: Actor, input: CreateEventInput): Promise<EventRow> {
  const artist = await resolveArtist(db, input.artistName);
  const [row] = await db
    .insert(events)
    .values({
      name: input.name,
      description: input.description ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      eventType: input.eventType ?? null,
      artistId: artist.artistId,
      artistName: artist.artistName,
      reservationEnabled: input.reservationEnabled ?? true,
      organizerId: actor.id,
      status: "draft",
    })
    .returning();
  if (!row) throw new Error("etkinlik eklenemedi");
  return row;
}

/** Form tam gönderilir: boş bırakılan isteğe bağlı alanlar temizlenir. */
export async function updateEvent(db: Db, actor: Actor, input: UpdateEventInput): Promise<EventRow> {
  return db.transaction(async (tx) => {
    // Durum denetimi ile yazma arasında eşzamanlı bir durum geçişi araya girmesin diye satır kilitlenir.
    const [existing] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!existing) throw new DomainError("not_found", NOT_FOUND);
    if (existing.status === "completed" || existing.status === "cancelled") {
      throw new DomainError("conflict", "Tamamlanmış veya iptal edilmiş etkinlik düzenlenemez");
    }
    // Alan verilmediyse ya da metin aynı kalıp bağ varsa bağ korunur (sanatçı sonradan adlandırılmış olabilir).
    const artist =
      input.artistName === undefined || (input.artistName === existing.artistName && existing.artistId !== null)
        ? { artistId: existing.artistId, artistName: existing.artistName }
        : await resolveArtist(tx, input.artistName);
    const [row] = await tx
      .update(events)
      .set({
        name: input.name,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        eventType: input.eventType ?? null,
        artistId: artist.artistId,
        artistName: artist.artistName,
        reservationEnabled: input.reservationEnabled ?? existing.reservationEnabled,
        reviewEnabled: input.reviewEnabled ?? existing.reviewEnabled,
        reviewHistoryVisible: input.reviewHistoryVisible ?? existing.reviewHistoryVisible,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.id))
      .returning();
    if (!row) throw new DomainError("not_found", NOT_FOUND);
    return row;
  });
}

/** Değerlendirme anahtarları: durumdan bağımsız (etkinlik bittikten sonra da açılıp kapanabilir). */
export async function setReviewSettings(db: Db, actor: Actor, input: ReviewSettingsInput): Promise<EventRow> {
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    const [row] = await tx
      .update(events)
      .set({
        reviewEnabled: input.reviewEnabled ?? locked.reviewEnabled,
        reviewHistoryVisible: input.reviewHistoryVisible ?? locked.reviewHistoryVisible,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.id))
      .returning();
    if (!row) throw new DomainError("not_found", NOT_FOUND);
    return row;
  });
}

export async function changeEventStatus(
  db: Db,
  actor: Actor,
  input: ChangeEventStatusInput,
): Promise<EventRow> {
  try {
    return await changeEventStatusTx(db, actor, input);
  } catch (error) {
    return mapArchiveWriteError(error);
  }
}

async function changeEventStatusTx(db: Db, actor: Actor, input: ChangeEventStatusInput): Promise<EventRow> {
  // Arşiv anlık görüntüsü tek tutarlı zamanda okunsun diye repeatable read.
  return db.transaction(async (tx) => {
    // Eşzamanlı iki geçişin aynı eski durumu görmemesi için satır kilitlenir.
    const [locked] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    if (!canTransitionEvent(locked.status, input.status)) {
      throw new DomainError(
        "conflict",
        `Etkinlik "${EVENT_STATUS_LABELS[locked.status]}" durumundan "${EVENT_STATUS_LABELS[input.status]}" durumuna geçilemez`,
      );
    }
    const [row] = await tx
      .update(events)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(events.id, input.id))
      .returning();
    if (!row) throw new DomainError("not_found", NOT_FOUND);
    // Tamamlanma ile arşiv aynı işlemde yazılır; arşiv başarısızsa durum da değişmez.
    if (input.status === "completed") await archiveEvent(tx, row.id, actor.id);
    return row;
  }, { isolationLevel: "repeatable read" });
}

/** Yalnızca taslak ve hiç rezervasyonu olmayan etkinlik silinir (iptal edilmiş rezervasyon da sayılır). */
export async function deleteEvent(db: Db, actor: Actor, input: DeleteEventInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    if (locked.status !== "draft") {
      throw new DomainError("conflict", "Yalnızca taslak etkinlikler silinebilir");
    }
    const [res] = await tx
      .select({ n: count() })
      .from(reservations)
      .where(eq(reservations.eventId, input.id));
    if ((res?.n ?? 0) > 0) {
      throw new DomainError("conflict", "Rezervasyonu olan etkinlik silinemez");
    }
    const [ord] = await tx.select({ n: count() }).from(orders).where(eq(orders.eventId, input.id));
    if ((ord?.n ?? 0) > 0) {
      throw new DomainError("conflict", "Siparişi olan etkinlik silinemez");
    }
    await tx.delete(events).where(eq(events.id, input.id));
    return { id: input.id };
  });
}

export async function listEvents(db: Executor, actor: Actor, filter: ListEventsFilter) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(events.status, filter.status));
  if (filter.search) conditions.push(ilike(events.name, `%${escapeLike(filter.search)}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const reservationCount = sql<number>`(select count(*)::int from ${reservations} where ${reservations.eventId} = "events"."id")`;

  const [items, totals] = await Promise.all([
    db
      .select({
        id: events.id,
        name: events.name,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        eventType: events.eventType,
        artistName: events.artistName,
        reservationCount,
      })
      .from(events)
      .where(where)
      .orderBy(desc(events.startsAt), asc(events.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(events).where(where),
  ]);

  return { items, total: totals[0]?.n ?? 0, page, pageSize };
}

export async function getEvent(db: Executor, actor: Actor, id: string) {
  const event = await getEventOrThrow(db, id);
  const [tables, capacity, reserved, assigned] = await Promise.all([
    db.select({ n: count() }).from(eventTables).where(eq(eventTables.eventId, id)),
    totalCapacity(db, id),
    db.select({ n: count() }).from(reservations).where(eq(reservations.eventId, id)),
    db.select({ n: count() }).from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, id)),
  ]);
  return {
    ...event,
    capacity,
    tableCount: tables[0]?.n ?? 0,
    reservationCount: reserved[0]?.n ?? 0,
    assignmentCount: assigned[0]?.n ?? 0,
  };
}

const BOARD_LIMIT = 500;

/**
 * Etkinlik panosu: sekmelere bölmek için tüm (sınırlı) liste, hazırlık göstergeleriyle.
 * Alan hazır = en az bir masa; ekip hazır = en az bir personel ataması.
 */
export async function listEventBoard(db: Executor, actor: Actor, filter: { search?: string | undefined }) {
  const conditions: SQL[] = [];
  if (filter.search) conditions.push(ilike(events.name, `%${escapeLike(filter.search)}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const reservationCount = sql<number>`(select count(*)::int from ${reservations} where ${reservations.eventId} = "events"."id")`;
  const tableCount = sql<number>`(select count(*)::int from ${eventTables} where ${eventTables.eventId} = "events"."id")`;
  const assignmentCount = sql<number>`(select count(*)::int from ${eventStaffAssignments} where ${eventStaffAssignments.eventId} = "events"."id")`;

  return db
    .select({
      id: events.id,
      name: events.name,
      description: events.description,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      eventType: events.eventType,
      artistName: events.artistName,
      planningStage: events.planningStage,
      reservationEnabled: events.reservationEnabled,
      reservationCount,
      tableCount,
      assignmentCount,
    })
    .from(events)
    .where(where)
    .orderBy(desc(events.startsAt), asc(events.id))
    .limit(BOARD_LIMIT);
}
