import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
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
      issued: 2,
      revenue: "3000.00",
      demoIssued: 2,
      demoRevenue: "5500.50",
      checkedIn: 0,
      byCategory: {
        standard: { issued: 2, revenue: "3000.00" },
        premium: { issued: 0, revenue: "0.00" },
        vip: { issued: 0, revenue: "0.00" },
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
      demoIssued: 3,
      demoRevenue: "4500.00",
    });
  });
});
