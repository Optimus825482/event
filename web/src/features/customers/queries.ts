import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, customerTags, events, guestNotes, reservations, users } from "@/db/schema";
import { authorize, type PolicyActor } from "@/features/auth/policy";
import { searchCustomersInput, type SearchCustomersInput } from "./schemas";
import { VIP_SCORE_THRESHOLD } from "./vip";
import { escapeLike } from "@/lib/identifiers";

type Executor = Db | Tx;

function searchCondition(q: string): SQL | undefined {
  const pattern = `%${escapeLike(q)}%`;
  const conditions: SQL[] = [ilike(customers.fullName, pattern), ilike(customers.email, pattern)];
  // Telefon: yalnızca rakamlarla, baştaki 0'lar atılarak normalize numaranın içinde aranır.
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length >= 3) conditions.push(ilike(customers.phoneNormalized, `%${digits}%`));
  return or(...conditions);
}

async function tagsByCustomer(db: Executor, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ customerId: customerTags.customerId, tag: customerTags.tag })
    .from(customerTags)
    .where(inArray(customerTags.customerId, ids))
    .orderBy(customerTags.tag);
  for (const row of rows) map.set(row.customerId, [...(map.get(row.customerId) ?? []), row.tag]);
  return map;
}

/** Ad, e-posta ve telefona göre sayfalı müşteri araması (en yeni önce). */
export async function searchCustomers(db: Executor, actor: PolicyActor, rawInput: SearchCustomersInput) {
  authorize(actor, "customers", "view");
  const { q, page, pageSize } = searchCustomersInput.parse(rawInput);
  const where = q ? searchCondition(q) : undefined;

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(customers).where(where);
  const total = countRow?.total ?? 0;

  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      vipScore: customers.vipScore,
      isBlacklisted: customers.isBlacklisted,
      noShowCount: customers.noShowCount,
      lastEventAt: customers.lastEventAt,
      createdAt: customers.createdAt,
      noteCount: sql<number>`(select count(*)::int from guest_notes where guest_notes.customer_id = customers.id)`,
      reservationCount: sql<number>`(select count(*)::int from reservations where reservations.customer_id = customers.id)`,
    })
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt), customers.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const tags = await tagsByCustomer(
    db,
    rows.map((r) => r.id),
  );
  return {
    items: rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type CustomerList = Awaited<ReturnType<typeof searchCustomers>>;

/** Müşteri + etiketler + notlar + rezervasyon geçmişi; yoksa `null`. */
export async function getCustomerDetail(db: Executor, actor: PolicyActor, id: string) {
  authorize(actor, "customers", "view");
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) return null;

  // Organizatör yalnızca kendi etkinliklerinin geçmişini ve notlarını görür (başkasının etkinlik adı sızmaz).
  const ownEventOnly = actor.role === "organizer";
  const [tags, notes, history] = await Promise.all([
    tagsByCustomer(db, [id]),
    db
      .select({
        id: guestNotes.id,
        content: guestNotes.content,
        noteType: guestNotes.noteType,
        createdAt: guestNotes.createdAt,
        eventName: events.name,
        createdByName: users.name,
      })
      .from(guestNotes)
      .leftJoin(events, eq(events.id, guestNotes.eventId))
      .leftJoin(users, eq(users.id, guestNotes.createdById))
      .where(
        and(
          eq(guestNotes.customerId, id),
          ownEventOnly ? or(isNull(guestNotes.eventId), eq(events.organizerId, actor.id)) : undefined,
        ),
      )
      .orderBy(desc(guestNotes.createdAt)),
    db
      .select({
        id: reservations.id,
        eventId: reservations.eventId,
        eventName: events.name,
        eventStartsAt: events.startsAt,
        status: reservations.status,
        guestCount: reservations.guestCount,
      })
      .from(reservations)
      .innerJoin(events, eq(events.id, reservations.eventId))
      .where(and(eq(reservations.customerId, id), ownEventOnly ? eq(events.organizerId, actor.id) : undefined))
      .orderBy(desc(events.startsAt))
      .limit(50),
  ]);

  return { customer, tags: tags.get(id) ?? [], notes, reservations: history };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;

/**
 * CRM/VIP analizi başlığı: tüm kayıtlar üzerinden toplam, VIP (puan eşiği ya da "VIP" etiketi),
 * kara liste ve toplam katılım. `searchCustomers` ile aynı görünürlük (`customers:view`).
 */
export async function getCustomerStats(db: Executor, actor: PolicyActor) {
  authorize(actor, "customers", "view");
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      vip: sql<number>`(count(*) filter (where ${customers.vipScore} >= ${VIP_SCORE_THRESHOLD} or exists (select 1 from customer_tags t where t.customer_id = "customers"."id" and lower(t.tag) = 'vip')))::int`,
      blacklisted: sql<number>`(count(*) filter (where ${customers.isBlacklisted}))::int`,
      attended: sql<number>`coalesce(sum(${customers.totalAttendedEvents}), 0)::int`,
    })
    .from(customers);
  return { total: row?.total ?? 0, vip: row?.vip ?? 0, blacklisted: row?.blacklisted ?? 0, attended: row?.attended ?? 0 };
}

export type CustomerStats = Awaited<ReturnType<typeof getCustomerStats>>;
