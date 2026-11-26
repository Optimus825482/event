import { randomUUID } from "node:crypto";
import { asc, eq, getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, events, orders, paymentAttempts, tableSeatSlots, tickets } from "@/db/schema";
import { pgConstraintOf } from "@/lib/pg-error";
import { truncateAll } from "../../helpers/db";
import { createEvent, createTable, pgErrorCode } from "../../helpers/factories";
import { openOnline } from "../../helpers/seating";

beforeEach(truncateAll);

/** 8 kapasiteli, online satışa açılmış tek masalı etkinlik; yuvalar `seat_no` sırasıyla. */
async function onlineTable() {
  const event = await createEvent(db);
  const table = await createTable(db, event.id, { capacity: 8, allocation: "pending" });
  await db.transaction((tx) => openOnline(tx, event.id, [table.id]));
  const slots = await db
    .select()
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, table.id))
    .orderBy(asc(tableSeatSlots.seatNo));
  return { event, table, slots };
}

async function order(eventId: string, o: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await db
    .insert(orders)
    .values({
      eventId,
      clientKey: randomUUID(),
      holdExpiresAt: new Date(Date.now() + 10 * 60_000),
      totalAmount: "0.00",
      currency: "TRY",
      ...o,
    })
    .returning();
  if (!row) throw new Error("sipariş eklenemedi");
  return row;
}

type TicketInput = Omit<typeof tickets.$inferInsert, "saleCategory" | "unitPrice"> &
  Partial<Pick<typeof tickets.$inferInsert, "saleCategory" | "unitPrice">>;

async function ticket(v: TicketInput) {
  const [row] = await db
    .insert(tickets)
    .values({ saleCategory: "standard", unitPrice: "1500.00", ...v })
    .returning();
  if (!row) throw new Error("bilet eklenemedi");
  return row;
}

/** Sözün reddedildiği SQLSTATE ve kısıt adını döndürür; reddedilmezse test düşer. */
async function violation(p: Promise<unknown>): Promise<{ code: string | undefined; constraint: string | undefined }> {
  try {
    await p;
  } catch (e) {
    return { code: pgErrorCode(e), constraint: pgConstraintOf(e) };
  }
  throw new Error("beklenen veritabanı hatası fırlatılmadı");
}

describe("şema: sipariş, bilet ve ödeme denemesi", () => {
  it("aynı yuvaya ikinci etkin bilet eklenemez (çifte satış kısıtı)", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    await ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id });
    expect(
      await violation(ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id })),
    ).toEqual({ code: "23505", constraint: "tickets_active_seat_uq" });
  });

  it("aynı yuvaya 10 eşzamanlı ham ekleme: tam 1 başarı (servis kilidi olmadan indeks tek başına yeter)", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(pgErrorCode(r.reason)).toBe("23505");
    expect(await db.select().from(tickets)).toHaveLength(1);
  });

  it("süresi dolan bilet yuvayı bırakır; aynı yuvaya yeni tutma eklenir", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    const first = await ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id });
    await db.update(tickets).set({ status: "expired", seatSlotId: null }).where(eq(tickets.id, first.id));
    const second = await ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id });
    expect(second.status).toBe("held");
    expect(await db.select().from(tickets)).toHaveLength(2);
  });

  it("etkin bilet yuvasız, süresi dolan bilet yuvalı olamaz", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    expect(await violation(ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: null }))).toEqual(
      { code: "23514", constraint: "tickets_active_has_slot" },
    );
    expect(
      await violation(
        ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id, status: "expired" }),
      ),
    ).toEqual({ code: "23514", constraint: "tickets_active_has_slot" });
  });

  it("issued bilet QR'sız olamaz", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    expect(
      await violation(
        ticket({
          orderId: o.id,
          eventId: event.id,
          tableId: table.id,
          seatSlotId: slots[0]!.id,
          status: "issued",
          qrToken: null,
        }),
      ),
    ).toEqual({ code: "23514", constraint: "tickets_issued_has_qr" });
  });

  it("ödenmiş sipariş PNR, alıcı ve onay taşımak zorundadır", async () => {
    const { event } = await onlineTable();
    const o = await order(event.id);
    expect(await violation(db.update(orders).set({ status: "paid" }).where(eq(orders.id, o.id)))).toEqual({
      code: "23514",
      constraint: "orders_paid_complete",
    });
    const now = new Date();
    const [paid] = await db
      .update(orders)
      .set({
        status: "paid",
        pnr: "ABCD2345",
        paidAt: now,
        buyerLastNameKey: "YILMAZ",
        buyerEmail: "alici@test.local",
        termsAcceptedAt: now,
        paymentProvider: "demo",
      })
      .where(eq(orders.id, o.id))
      .returning();
    expect(paid?.status).toBe("paid");
  });

  it("sipariş ve bilet durumu sözlük dışı olamaz", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    expect(
      await violation(
        db
          .update(orders)
          .set({ status: "refunded" as never })
          .where(eq(orders.id, o.id)),
      ),
    ).toEqual({ code: "23514", constraint: "orders_status_valid" });
    const t = await ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id });
    expect(
      await violation(
        db
          .update(tickets)
          // Yuva boşaltılır ki yalnızca sözlük kısıtı ihlal edilsin (tickets_active_has_slot değil).
          .set({ status: "used" as never, seatSlotId: null })
          .where(eq(tickets.id, t.id)),
      ),
    ).toEqual({ code: "23514", constraint: "tickets_status_valid" });
    expect(
      await violation(
        db.insert(paymentAttempts).values({
          orderId: o.id,
          provider: "demo",
          outcome: "pending" as never,
          amount: "0.00",
          currency: "TRY",
          isDemo: true,
        }),
      ),
    ).toEqual({ code: "23514", constraint: "payment_attempts_outcome_valid" });
  });

  it("aynı clientKey ve aynı PNR ikinci siparişte reddedilir", async () => {
    const { event } = await onlineTable();
    const first = await order(event.id, { pnr: "PNRX2345" });
    expect(await violation(order(event.id, { clientKey: first.clientKey }))).toEqual({
      code: "23505",
      constraint: "orders_client_key_uq",
    });
    expect(await violation(order(event.id, { pnr: "PNRX2345" }))).toEqual({
      code: "23505",
      constraint: "orders_pnr_uq",
    });
  });

  it("bilet başka masanın yuvasına bağlanamaz", async () => {
    const { event, table } = await onlineTable();
    const other = await createTable(db, event.id, { capacity: 8, allocation: "pending" });
    await db.transaction((tx) => openOnline(tx, event.id, [other.id]));
    const [otherSlot] = await db.select().from(tableSeatSlots).where(eq(tableSeatSlots.tableId, other.id)).limit(1);
    const o = await order(event.id);
    expect(
      await violation(ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: otherSlot!.id })),
    ).toEqual({ code: "23503", constraint: "tickets_seat_slot_fk" });
  });

  it("bileti olan yuva ve masa silinemez", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    await ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id });
    expect(await violation(db.delete(tableSeatSlots).where(eq(tableSeatSlots.id, slots[0]!.id)))).toEqual({
      code: "23503",
      constraint: "tickets_seat_slot_fk",
    });
    const tableDelete = await violation(db.delete(eventTables).where(eq(eventTables.id, table.id)));
    expect(tableDelete.code).toBe("23503");
  });

  it("siparişi olan etkinlik silinemez", async () => {
    const { event } = await onlineTable();
    await order(event.id);
    expect((await violation(db.delete(events).where(eq(events.id, event.id)))).code).toBe("23503");
  });

  it("kapı numarası 1-9 dışında olamaz", async () => {
    const { event, table, slots } = await onlineTable();
    const o = await order(event.id);
    expect(
      await violation(
        ticket({ orderId: o.id, eventId: event.id, tableId: table.id, seatSlotId: slots[0]!.id, checkInGate: 0 }),
      ),
    ).toEqual({ code: "23514", constraint: "tickets_gate_range" });
  });

  it("hiçbir bilet/sipariş/ödeme sütunu kart verisi taşımaz", () => {
    const names = [orders, tickets, paymentAttempts].flatMap((t) =>
      Object.values(getTableColumns(t)).map((c) => c.name),
    );
    expect(names.filter((n) => /card|pan|cvv|cvc|iban|expiry/i.test(n))).toEqual([]);
  });
});
