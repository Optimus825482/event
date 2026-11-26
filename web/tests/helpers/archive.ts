import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  artists,
  eventArchives,
  eventExtraStaff,
  eventFinanceItems,
  eventTables,
  events,
  orders,
  tickets,
} from "@/db/schema";
import type { EventRow } from "@/features/events/service";
import type { FinanceCategory } from "@/features/finance/constants";
import type { EventTableRow } from "@/features/reservations/internal";
import type { OrderView } from "@/features/ticketing/orders-service";
import {
  createAssignment,
  createCustomer,
  createEvent,
  createReservation,
  createShift,
  createStaff,
  createTable,
} from "./factories";
import { setStage } from "./planning";
import { openOnline, setFinalPrices } from "./seating";
import { createPaidOrder } from "./ticketing";

type Ex = Db | Tx;

export type ArtistRow = typeof artists.$inferSelect;
export type ArchiveRow = typeof eventArchives.$inferSelect;

/** `event_finance_items`'a doğrudan bir kalem ekler. */
export async function addFinanceItem(
  ex: Ex,
  eventId: string,
  item: {
    direction: "expense" | "income";
    category: string;
    label: string;
    estimatedAmount: string;
    actualAmount?: string | null;
  },
): Promise<void> {
  await ex.insert(eventFinanceItems).values({
    eventId,
    direction: item.direction,
    category: item.category as FinanceCategory,
    label: item.label,
    estimatedAmount: item.estimatedAmount,
    actualAmount: item.actualAmount ?? null,
  });
}

/** Demo sağlayıcıyla ödenen siparişi gerçek sayar (`is_demo = false`). Yalnızca test kurulumu içindir. */
export async function markOrderReal(ex: Ex, orderId: string): Promise<void> {
  await ex.update(orders).set({ isDemo: false }).where(eq(orders.id, orderId));
}

/** Bileti kapıdan geçmiş sayar; geçiş kuralları atlanır. */
export async function checkInTicket(ex: Ex, ticketId: string, gate: number | null): Promise<void> {
  await ex.update(tickets).set({ checkedInAt: sql`now()`, checkInGate: gate }).where(eq(tickets.id, ticketId));
}

export async function getArchiveRow(ex: Ex, eventId: string): Promise<ArchiveRow | undefined> {
  const [row] = await ex.select().from(eventArchives).where(eq(eventArchives.eventId, eventId));
  return row;
}

/** `completed` bir etkinlik yaratır ve verilen değerlerle arşiv satırını doğrudan ekler. */
export async function insertArchive(
  ex: Ex,
  o: Partial<typeof eventArchives.$inferInsert> & { startsAt: Date },
): Promise<ArchiveRow> {
  const event = await createEvent(ex, { status: "completed", startsAt: o.startsAt });
  const [row] = await ex
    .insert(eventArchives)
    .values({
      eventName: event.name,
      archivedAt: new Date(),
      details: { categories: [], financeItems: [], gates: [] },
      ...o,
      eventId: o.eventId ?? event.id,
    })
    .returning();
  if (!row) throw new Error("arşiv satırı eklenemedi");
  return row;
}

type TableKey = "C1" | "C2" | "O1" | "O2" | "P1";

export type Scenario = {
  event: EventRow;
  artist: ArtistRow;
  tables: Record<TableKey, EventTableRow>;
  orders: { realO1: OrderView; demoO2: OrderView; realO2: OrderView };
};

/** Sabit "Gala" senaryosu (etkinlik `active`, aşama `on_sale`, henüz tamamlanmamış). */
export async function seedScenario(db: Db): Promise<Scenario> {
  const [artist] = await db.insert(artists).values({ name: "Sezen Aksu", nameKey: "SEZEN AKSU" }).returning();
  if (!artist) throw new Error("sanatçı eklenemedi");

  const created = await createEvent(db, {
    name: "Gala",
    status: "active",
    startsAt: new Date("2027-01-10T18:00:00Z"),
    eventType: "Konser",
    artistId: artist.id,
    artistName: "Sezen Aksu",
  });
  await setStage(db, created.id, "on_sale");

  const tables: Record<TableKey, EventTableRow> = {
    C1: await createTable(db, created.id, { label: "C1", capacity: 10, allocation: "casino" }),
    C2: await createTable(db, created.id, { label: "C2", capacity: 10, allocation: "casino" }),
    O1: await createTable(db, created.id, {
      label: "O1",
      capacity: 8,
      saleCategory: "standard",
      sellableSeats: null,
      allocation: "pending",
    }),
    O2: await createTable(db, created.id, {
      label: "O2",
      capacity: 8,
      saleCategory: "vip",
      sellableSeats: 6,
      allocation: "pending",
    }),
    P1: await createTable(db, created.id, { label: "P1", capacity: 4, allocation: "pending" }),
  };
  await db.transaction((tx) => openOnline(tx, created.id, [tables.O1.id, tables.O2.id]));
  await setFinalPrices(db, created.id, { standard: "100.00", vip: "250.50" });
  // Tahsis değişti; masaları güncel hâliyle yeniden oku.
  for (const key of Object.keys(tables) as TableKey[]) {
    const [row] = await db.select().from(eventTables).where(eq(eventTables.id, tables[key].id));
    if (!row) throw new Error("masa okunamadı");
    tables[key] = row;
  }

  const realO1 = await createPaidOrder(db, { eventId: created.id, items: [{ tableId: tables.O1.id, quantity: 3 }] });
  await markOrderReal(db, realO1.orderId);
  const demoO2 = await createPaidOrder(db, { eventId: created.id, items: [{ tableId: tables.O2.id, quantity: 2 }] });
  const realO2 = await createPaidOrder(db, { eventId: created.id, items: [{ tableId: tables.O2.id, quantity: 1 }] });
  await markOrderReal(db, realO2.orderId);

  const [first, second] = realO1.tickets;
  if (!first || !second) throw new Error("realO1 biletleri eksik");
  await checkInTicket(db, first.ticketId, 1);
  await checkInTicket(db, second.ticketId, 1);

  const customer = await createCustomer(db);
  await createReservation(db, {
    eventId: created.id,
    tableId: tables.C1.id,
    customerId: customer.id,
    status: "checked_in",
    guestCount: 6,
    checkedInAt: new Date(),
    checkInGate: 2,
  });
  await createReservation(db, {
    eventId: created.id,
    tableId: tables.C2.id,
    customerId: customer.id,
    status: "confirmed",
    guestCount: 4,
  });
  await createReservation(db, {
    eventId: created.id,
    tableId: tables.C2.id,
    customerId: customer.id,
    status: "cancelled",
    guestCount: 5,
  });

  const [shift1, shift2] = [await createShift(db), await createShift(db)];
  const [staffA, staffB, staffC] = [await createStaff(db), await createStaff(db), await createStaff(db)];
  await createAssignment(db, { eventId: created.id, staffId: staffA.id, shiftId: shift1.id });
  await createAssignment(db, { eventId: created.id, staffId: staffA.id, shiftId: shift2.id });
  await createAssignment(db, { eventId: created.id, staffId: staffB.id });
  await createAssignment(db, { eventId: created.id, staffId: staffC.id, isActive: false });
  await db.insert(eventExtraStaff).values([
    { eventId: created.id, fullName: "Ek Personel 1" },
    { eventId: created.id, fullName: "Ek Personel 2" },
    { eventId: created.id, fullName: "Ek Personel 3", isActive: false },
  ]);

  await addFinanceItem(db, created.id, {
    direction: "expense",
    category: "artist_fee",
    label: "Sanatçı ücreti",
    estimatedAmount: "1000.00",
    actualAmount: "1200.00",
  });
  await addFinanceItem(db, created.id, {
    direction: "expense",
    category: "production",
    label: "Sahne",
    estimatedAmount: "500.10",
    actualAmount: "480.00",
  });
  await addFinanceItem(db, created.id, {
    direction: "income",
    category: "sponsorship",
    label: "Sponsor",
    estimatedAmount: "300.00",
    actualAmount: "250.25",
  });

  const [event] = await db.select().from(events).where(eq(events.id, created.id));
  if (!event) throw new Error("etkinlik okunamadı");
  return { event, artist, tables, orders: { realO1, demoO2, realO2 } };
}
