import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventFinancePlans, eventSeatPrices, events } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { computeRecommendation, previewRecommendation } from "@/features/finance/recommendation-service";
import { getFinancePlan } from "@/features/finance/plan-service";
import { getSeatPrices } from "@/features/seating/prices";
import { DomainError } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createFinanceItem, setFinancePlan } from "../../helpers/finance";
import { setAllocation, setFinalPrices, setSaleSettings } from "../../helpers/seating";

/** 2 standard online (4), 1 premium pending (4, satılabilir 2), 1 casino (10); gider 100000, sponsorluk 20000. */
async function setup() {
  const event = await f.createEvent(db);
  const standard = [
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online", capacity: 4 }),
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online", capacity: 4 }),
  ];
  const premium = await f.createTable(db, event.id, {
    saleCategory: "premium",
    allocation: "pending",
    capacity: 4,
    sellableSeats: 2,
  });
  await f.createTable(db, event.id, { saleCategory: "standard", allocation: "casino", capacity: 10 });
  await createFinanceItem(db, event.id, { direction: "expense", category: "production", estimatedAmount: "100000.00" });
  await createFinanceItem(db, event.id, { direction: "income", category: "sponsorship", estimatedAmount: "20000.00" });
  const ent = await persistActor(db, managerActor("entertainment"));
  return { event, ent, tableIds: [...standard, premium].map((t) => t.id) };
}

async function priceRows(eventId: string) {
  return db.select().from(eventSeatPrices).where(eq(eventSeatPrices.eventId, eventId));
}

describe("tavsiye fiyat servisi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("öneri hesaplanır, kaydedilir ve varsayımlar döner", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await db
      .insert(eventSeatPrices)
      .values({ eventId: event.id, category: "premium", coefficient: "2.000" });

    const view = await computeRecommendation(db, ent, { eventId: event.id });
    expect(view.reason).toBe("ok");
    expect(view.prices).toEqual({ standard: "8334.00", premium: "16667.00", vip: null });
    expect(view.base).toBe("8333.34");
    expect(view.assumptions).toMatchObject({
      estimatedExpense: "100000.00",
      targetProfit: "20000.00",
      estimatedOtherIncome: "20000.00",
      casinoCostMode: "free",
      casinoCapacity: 10,
      casinoShare: "0.00",
      distributable: "100000.00",
      locaOnline: false,
      seats: { standard: 8, premium: 2, vip: 0 },
      coefficients: { standard: "1.000", premium: "2.000", vip: "1.000" },
    });

    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.recommendedPrice).toBe("8334.00");
    expect(prices.premium.recommendedPrice).toBe("16667.00");
    expect(prices.vip.recommendedPrice).toBeNull();
    expect((await getFinancePlan(db, event.id)).recommendedAt).toBeInstanceOf(Date);
  });

  it("Casino payı 'transfer' iken kapasite × fiyat düşülür", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, {
      targetProfit: "20000.00",
      casinoCostMode: "transfer",
      casinoTransferPrice: "1000.00",
    });
    await db.insert(eventSeatPrices).values({ eventId: event.id, category: "premium", coefficient: "2.000" });
    const view = await computeRecommendation(db, ent, { eventId: event.id });
    expect(view.assumptions.casinoShare).toBe("10000.00");
    expect(view.assumptions.distributable).toBe("90000.00");
    expect(view.prices.standard).toBe("7500.00");
  });

  it("öneri kesin fiyatı ve katsayıyı değiştirmez", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await db.insert(eventSeatPrices).values({ eventId: event.id, category: "premium", coefficient: "2.000" });
    await setFinalPrices(db, event.id, { standard: "9000.00" });
    await computeRecommendation(db, ent, { eventId: event.id });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard).toEqual({ finalPrice: "9000.00", recommendedPrice: "8334.00", coefficient: "1.000" });
    expect(prices.premium.coefficient).toBe("2.000");
  });

  it("locaOnline kapalıyken loca sandalyeleri paydaya girmez, açılınca girer", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await f.createTable(db, event.id, { saleCategory: "vip", allocation: "online", capacity: 6, isLoca: true });

    const closed = await computeRecommendation(db, ent, { eventId: event.id });
    expect(closed.assumptions.seats.vip).toBe(0);
    expect(closed.prices.vip).toBeNull();

    await setSaleSettings(db, event.id, { locaOnline: true });
    const open = await computeRecommendation(db, ent, { eventId: event.id });
    expect(open.assumptions.locaOnline).toBe(true);
    expect(open.assumptions.seats.vip).toBe(6);
    expect(open.prices.vip).not.toBeNull();
  });

  it("satılabilir sandalye yoksa öneri üretilmez ve kayıtlı öneri temizlenir", async () => {
    const { event, ent, tableIds } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await computeRecommendation(db, ent, { eventId: event.id });
    expect((await getSeatPrices(db, event.id)).standard.recommendedPrice).not.toBeNull();

    await setAllocation(db, tableIds, "closed");
    const view = await computeRecommendation(db, ent, { eventId: event.id });
    expect(view.reason).toBe("no_seats");
    expect(view.prices).toEqual({ standard: null, premium: null, vip: null });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.recommendedPrice).toBeNull();
    expect(prices.premium.recommendedPrice).toBeNull();
    expect((await getFinancePlan(db, event.id)).recommendedAt).toBeNull();
  });

  it("previewRecommendation hiçbir şey yazmaz", async () => {
    const { event } = await setup();
    const view = await previewRecommendation(db, event.id);
    expect(view.reason).toBe("ok");
    expect(await priceRows(event.id)).toHaveLength(0);
    expect(await db.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, event.id))).toHaveLength(0);
  });

  it.each(["completed", "cancelled"] as const)("%s etkinlikte öneri kaydedilmez → conflict", async (status) => {
    const { event, ent } = await setup();
    await db.update(events).set({ status }).where(eq(events.id, event.id));
    const error = await computeRecommendation(db, ent, { eventId: event.id }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "conflict" });
    expect(await priceRows(event.id)).toHaveLength(0);
  });

  it("olmayan etkinlik → not_found", async () => {
    const { ent } = await setup();
    await expect(computeRecommendation(db, ent, { eventId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("finance:edit olmayan aktör hesaplayamaz", async () => {
    const { event } = await setup();
    const viewer = memberActor("entertainment", { finance: "v---" });
    await expect(computeRecommendation(db, viewer, { eventId: event.id })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await priceRows(event.id)).toHaveLength(0);
  });
});
