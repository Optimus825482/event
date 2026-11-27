import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventArchives, eventExtraStaff, eventStaffAssignments, eventTables, events, orders, reservations, tickets } from "@/db/schema";
import { archiveEvent, buildArchiveSnapshot } from "@/features/archive/snapshot";
import { addFinanceItem, checkInTicket, getArchiveRow, seedScenario } from "../../helpers/archive";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

beforeEach(truncateAll);

const build = (eventId: string) => db.transaction((tx) => buildArchiveSnapshot(tx, eventId));

describe("arşiv anlık görüntüsü", () => {
  it("senaryonun anlık görüntüsü kaynaklarla birebir", async () => {
    const s = await seedScenario(db);
    const snap = await build(s.event.id);
    expect(snap).toMatchObject({
      eventId: s.event.id,
      eventName: "Gala",
      eventType: "Konser",
      artistId: s.artist.id,
      artistName: "Sezen Aksu",
      startsAt: new Date("2027-01-10T18:00:00Z"),
      currency: "TRY",
      tableCount: 5,
      totalCapacity: 40,
      casinoTableCount: 2,
      casinoSeatCount: 20,
      onlineTableCount: 2,
      sellableSeatCount: 14,
      ticketsSold: 6,
      ticketRevenue: "1051.50",
      demoTicketsSold: 0,
      demoTicketRevenue: "0.00",
      ticketsCheckedIn: 2,
      reservationCount: 2,
      reservationsCheckedIn: 1,
      reservationsNoShow: 1,
      guestsExpected: 10,
      guestsCheckedIn: 6,
      fnbStaffCount: 4,
      artistFee: "1200.00",
      estimatedExpense: "1500.10",
      actualExpense: "1680.00",
      estimatedOtherIncome: "300.00",
      actualOtherIncome: "250.25",
    });
    expect(snap.details).toEqual({
      categories: [
        { category: "standard", label: "Standart", issued: 3, revenue: "300.00" },
        { category: "premium", label: "Premium", issued: 0, revenue: "0.00" },
        { category: "vip", label: "VIP", issued: 3, revenue: "751.50" },
      ],
      financeItems: [
        { direction: "expense", category: "artist_fee", label: "Sanatçı ücreti", estimatedAmount: "1000.00", actualAmount: "1200.00" },
        { direction: "expense", category: "production", label: "Sahne", estimatedAmount: "500.10", actualAmount: "480.00" },
        { direction: "income", category: "sponsorship", label: "Sponsor", estimatedAmount: "300.00", actualAmount: "250.25" },
      ],
      gates: [
        { gate: 1, tickets: 2, reservations: 0 },
        { gate: 2, tickets: 0, reservations: 1 },
      ],
    });
    expect(snap).not.toHaveProperty("revision");
  });

  it("yalnızca demo satışı olan etkinlikte gerçek bilet ve gelir sıfırdır", async () => {
    const s = await seedScenario(db);
    await db.update(events).set({ isDemo: true }).where(eq(events.id, s.event.id));
    const snap = await build(s.event.id);
    expect(snap).toMatchObject({ ticketsSold: 0, ticketRevenue: "0.00", demoTicketsSold: 6, demoTicketRevenue: "1051.50" });
    expect(snap.details!.categories.map((c) => c.issued)).toEqual([0, 0, 0]);
  });

  it("masasız, satışsız, personelsiz etkinlik sıfırlarla arşivlenir", async () => {
    const event = await f.createEvent(db);
    const snap = await build(event.id);
    expect(snap).toMatchObject({
      artistId: null,
      artistFee: null,
      tableCount: 0,
      totalCapacity: 0,
      casinoTableCount: 0,
      casinoSeatCount: 0,
      onlineTableCount: 0,
      sellableSeatCount: 0,
      ticketsSold: 0,
      ticketRevenue: "0.00",
      demoTicketsSold: 0,
      demoTicketRevenue: "0.00",
      ticketsCheckedIn: 0,
      reservationCount: 0,
      reservationsCheckedIn: 0,
      reservationsNoShow: 0,
      guestsExpected: 0,
      guestsCheckedIn: 0,
      fnbStaffCount: 0,
      estimatedExpense: "0.00",
      actualExpense: "0.00",
      estimatedOtherIncome: "0.00",
      actualOtherIncome: "0.00",
    });
    expect(snap.details).toEqual({
      categories: [
        { category: "standard", label: "Standart", issued: 0, revenue: "0.00" },
        { category: "premium", label: "Premium", issued: 0, revenue: "0.00" },
        { category: "vip", label: "VIP", issued: 0, revenue: "0.00" },
      ],
      financeItems: [],
      gates: [],
    });
  });

  it("kapısı boş giriş 'gate: null' grubunda ve en sonda", async () => {
    const s = await seedScenario(db);
    const free = (await db.select().from(tickets).where(eq(tickets.eventId, s.event.id))).find((x) => x.checkedInAt === null);
    expect(free).toBeDefined();
    await checkInTicket(db, free!.id, null);
    const snap = await build(s.event.id);
    const gates = snap.details!.gates;
    expect(gates[gates.length - 1]).toEqual({ gate: null, tickets: 1, reservations: 0 });
    expect(gates.map((g) => g.gate)).toEqual([1, 2, null]);
  });

  it("aynı personelin iki ataması bir kişi sayılır; pasif atama ve pasif ek personel sayılmaz", async () => {
    const s = await seedScenario(db);
    expect(await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, s.event.id))).toHaveLength(4);
    expect(await db.select().from(eventExtraStaff).where(eq(eventExtraStaff.eventId, s.event.id))).toHaveLength(3);
    expect((await build(s.event.id)).fnbStaffCount).toBe(4);
  });

  it("no_show sayımı: açık no_show ve pending gelmemiş sayılır, iptal sayılmaz", async () => {
    const event = await f.createEvent(db);
    const table = await f.createTable(db, event.id, { label: "C1", capacity: 10, allocation: "casino" });
    const customer = await f.createCustomer(db);
    const t2 = await f.createTable(db, event.id, { label: "C2", capacity: 10, allocation: "casino" });
    const t3 = await f.createTable(db, event.id, { label: "C3", capacity: 10, allocation: "casino" });
    const mk = (tableId: string, status: "no_show" | "pending" | "cancelled", guestCount: number) =>
      f.createReservation(db, { eventId: event.id, tableId, customerId: customer.id, status, guestCount });
    await mk(table.id, "no_show", 3);
    await mk(t2.id, "pending", 2);
    await mk(t3.id, "cancelled", 5);
    const snap = await build(event.id);
    expect(snap).toMatchObject({
      reservationCount: 2,
      reservationsNoShow: 2,
      reservationsCheckedIn: 0,
      guestsExpected: 5,
      guestsCheckedIn: 0,
    });
  });

  it("olmayan etkinlik → not_found 'Etkinlik bulunamadı'", async () => {
    await expect(build("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      code: "not_found",
      message: "Etkinlik bulunamadı",
    });
  });

  it("archiveEvent ilk yazımda revision 1, tekrarında 2 ve güncel değerler", async () => {
    const s = await seedScenario(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    await db.transaction((tx) => archiveEvent(tx, s.event.id, actor.id));
    expect(await getArchiveRow(db, s.event.id)).toMatchObject({ revision: 1, archivedBy: actor.id, ticketsSold: 6 });
    await addFinanceItem(db, s.event.id, {
      direction: "expense",
      category: "other",
      label: "Ek",
      estimatedAmount: "0.00",
      actualAmount: "19.90",
    });
    await db.transaction((tx) => archiveEvent(tx, s.event.id, null));
    expect(await getArchiveRow(db, s.event.id)).toMatchObject({ revision: 2, archivedBy: null, actualExpense: "1699.90" });
    expect(await db.select().from(eventArchives)).toHaveLength(1);
  });

  it("archiveEvent kaynak satırlara yazmaz", async () => {
    const s = await seedScenario(db);
    const read = async () => ({
      reservations: await db.select().from(reservations).orderBy(reservations.id),
      orders: await db.select().from(orders).orderBy(orders.id),
      tickets: await db.select().from(tickets).orderBy(tickets.id),
      tables: await db.select().from(eventTables).orderBy(eventTables.id),
    });
    const before = await read();
    await db.transaction((tx) => archiveEvent(tx, s.event.id, null));
    expect(await read()).toEqual(before);
  });
});

describe("arşiv para birimi denetimi", () => {
  it("sipariş para birimi satış ayarlarından farklıysa conflict", async () => {
    const s = await seedScenario(db);
    await db.update(orders).set({ currency: "USD" }).where(eq(orders.eventId, s.event.id));
    await expect(build(s.event.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("siparişler arasında karışık para birimi conflict", async () => {
    const s = await seedScenario(db);
    const [first] = await db.select().from(orders).where(eq(orders.eventId, s.event.id));
    await db.update(orders).set({ currency: "USD" }).where(eq(orders.id, first!.id));
    await expect(build(s.event.id)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("demo arşiv anlık görüntüsü", () => {
  it("demo etkinliğin arşivinde gerçek bilet ve ciro sıfırdır", async () => {
    const s = await seedScenario(db);
    await db.update(events).set({ isDemo: true }).where(eq(events.id, s.event.id));
    const snap = await build(s.event.id);
    expect(snap).toMatchObject({
      ticketsSold: 0,
      ticketRevenue: "0.00",
      demoTicketsSold: 6,
      demoTicketRevenue: "1051.50",
    });
  });
});
