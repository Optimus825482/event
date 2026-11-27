import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, systemSettings, tickets } from "@/db/schema";
import { payOrder } from "@/features/ticketing/orders-service";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { getSalesTotals } from "@/features/ticketing/stats";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder, createPendingHold } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

const zero = {
  standard: { issued: 0, revenue: "0.00" },
  premium: { issued: 0, revenue: "0.00" },
  vip: { issued: 0, revenue: "0.00" },
};

describe("satış toplamları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("gerçek ve demo satış ayrı toplanır; kategori kırılımı demo içermez", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({
      tables: [{ label: "A1" }, { label: "B1", category: "vip" }],
      prices: { standard: "1500.00", premium: "2500.00", vip: "4000.50" },
    });
    const real: PaymentProvider = {
      id: "demo",
      isDemo: false,
      start: async () => ({ outcome: "approved", providerRef: "r" }),
    };
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ali", lastName: "Veli", email: "a@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: real },
    );
    await createPaidOrder(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 1 },
        { tableId: b1!.id, quantity: 1 },
      ],
    });
    await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 1 }],
    });

    expect(await getSalesTotals(db, event.id)).toEqual({
      issued: 4,
      revenue: "8500.50",
      demoIssued: 0,
      demoRevenue: "0.00",
      checkedIn: 0,
      byCategory: {
        standard: { issued: 3, revenue: "4500.00" },
        premium: { issued: 0, revenue: "0.00" },
        vip: { issued: 1, revenue: "4000.50" },
      },
    });
  });

  it("satışsız etkinlikte tüm toplamlar sıfırdır", async () => {
    const { event } = await saleEvent();
    expect(await getSalesTotals(db, event.id)).toEqual({
      issued: 0,
      revenue: "0.00",
      demoIssued: 0,
      demoRevenue: "0.00",
      checkedIn: 0,
      byCategory: zero,
    });
  });

  it("giriş yapan bilet sayılır (demo dahil)", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    for (const t of paid.tickets)
      await db
        .update(tickets)
        .set({ checkedInAt: new Date() })
        .where(eq(tickets.id, t.ticketId));
    expect((await getSalesTotals(db, event.id)).checkedIn).toBe(2);
  });

  it("başka etkinliğin satışları karışmaz", async () => {
    const first = await saleEvent();
    const second = await saleEvent();
    await createPaidOrder(db, {
      eventId: second.event.id,
      items: [{ tableId: second.tables[0]!.id, quantity: 3 }],
    });
    expect(await getSalesTotals(db, first.event.id)).toMatchObject({
      issued: 0,
      demoIssued: 0,
      demoRevenue: "0.00",
    });
    expect(await getSalesTotals(db, second.event.id)).toMatchObject({
      issued: 3,
      revenue: "4500.00",
    });
  });

  it("gerçek toplam kategori toplamlarına eşittir", async () => {
    const {
      event,
      tables: [a1, b1, c1],
    } = await saleEvent({
      tables: [
        { label: "A1" },
        { label: "B1", category: "premium" },
        { label: "C1", category: "vip" },
      ],
      prices: { standard: "1500.00", premium: "2500.25", vip: "4000.50" },
    });
    const real: PaymentProvider = {
      id: "demo",
      isDemo: false,
      start: async () => ({ outcome: "approved", providerRef: "r" }),
    };
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 2 },
        { tableId: b1!.id, quantity: 3 },
        { tableId: c1!.id, quantity: 1 },
      ],
    });
    await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ali", lastName: "Veli", email: "a@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: real },
    );
    const t = await getSalesTotals(db, event.id);
    expect(t.issued).toBe(6);
    expect(t.revenue).toBe("14501.25");
    const cats = Object.values(t.byCategory);
    expect(cats.reduce((n, c) => n + c.issued, 0)).toBe(t.issued);
    const [sum] = (
      await db.execute(
        sql`select (${sql.join(
          cats.map((c) => sql`${c.revenue}::numeric`),
          sql` + `,
        )})::numeric(12,2)::text as sum`,
      )
    ).rows as { sum: string }[];
    expect(sum?.sum).toBe(t.revenue);
  });

  it("demo etkinliğin biletleri gerçek toplama girmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ prices: { standard: "1500.00" } });
    await db.update(events).set({ isDemo: true }).where(eq(events.id, event.id));
    await db.insert(systemSettings).values({ salesDemoEnabled: true });

    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 3 }],
    });

    expect(await getSalesTotals(db, event.id)).toEqual({
      issued: 0,
      revenue: "0.00",
      demoIssued: 3,
      demoRevenue: "4500.00",
      checkedIn: 0,
      byCategory: zero,
    });
  });

  it("gerçek etkinlikte demo sağlayıcıyla ödenen bilet gerçek toplamdadır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ prices: { standard: "1500.00" } });

    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 3 }],
    });

    expect(await getSalesTotals(db, event.id)).toEqual({
      issued: 3,
      revenue: "4500.00",
      demoIssued: 0,
      demoRevenue: "0.00",
      checkedIn: 0,
      byCategory: {
        standard: { issued: 3, revenue: "4500.00" },
        premium: { issued: 0, revenue: "0.00" },
        vip: { issued: 0, revenue: "0.00" },
      },
    });
  });
});
