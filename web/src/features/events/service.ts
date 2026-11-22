import { and, asc, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, events, reservations } from "@/db/schema";
import { canTransitionEvent } from "@/domain/event-status";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { EVENT_STATUS_LABELS } from "./labels";
import type {
  ChangeEventStatusInput,
  CreateEventInput,
  DeleteEventInput,
  ListEventsFilter,
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

/** Organizatör yalnızca kendi etkinliğine erişir; başkasınınki "yok" gibi davranır. */
function assertAccess(actor: Actor, event: EventRow): void {
  if (actor.role === "organizer" && event.organizerId !== actor.id) {
    throw new DomainError("not_found", NOT_FOUND);
  }
}

async function getAccessibleEvent(db: Executor, actor: Actor, id: string): Promise<EventRow> {
  const event = await getEventOrThrow(db, id);
  assertAccess(actor, event);
  return event;
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
  const [row] = await db
    .insert(events)
    .values({
      name: input.name,
      description: input.description ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      eventType: input.eventType ?? null,
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
    assertAccess(actor, existing);
    if (existing.status === "completed" || existing.status === "cancelled") {
      throw new DomainError("conflict", "Tamamlanmış veya iptal edilmiş etkinlik düzenlenemez");
    }
    const [row] = await tx
      .update(events)
      .set({
        name: input.name,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        eventType: input.eventType ?? null,
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

export async function changeEventStatus(
  db: Db,
  actor: Actor,
  input: ChangeEventStatusInput,
): Promise<EventRow> {
  return db.transaction(async (tx) => {
    // Eşzamanlı iki geçişin aynı eski durumu görmemesi için satır kilitlenir.
    const [locked] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    assertAccess(actor, locked);
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
    return row;
  });
}

/** Yalnızca taslak ve hiç rezervasyonu olmayan etkinlik silinir (iptal edilmiş rezervasyon da sayılır). */
export async function deleteEvent(db: Db, actor: Actor, input: DeleteEventInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, input.id)).for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    assertAccess(actor, locked);
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
    await tx.delete(events).where(eq(events.id, input.id));
    return { id: input.id };
  });
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listEvents(db: Executor, actor: Actor, filter: ListEventsFilter) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions: SQL[] = [];
  if (actor.role === "organizer") conditions.push(eq(events.organizerId, actor.id));
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
  const event = await getAccessibleEvent(db, actor, id);
  const [tables, capacity, reserved] = await Promise.all([
    db.select({ n: count() }).from(eventTables).where(eq(eventTables.eventId, id)),
    totalCapacity(db, id),
    db.select({ n: count() }).from(reservations).where(eq(reservations.eventId, id)),
  ]);
  return {
    ...event,
    capacity,
    tableCount: tables[0]?.n ?? 0,
    reservationCount: reserved[0]?.n ?? 0,
  };
}
