import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventFinancePlans, eventSeatPrices, events } from "@/db/schema";
import { createFinanceItem as createItemService } from "@/features/finance/items-service";
import { saveFinancePlan } from "@/features/finance/plan-service";
import { ForbiddenError } from "@/features/auth/errors";
import { lockEditableEvent, saveFinalPrices } from "@/features/finance/price-service";
import { computeRecommendation, previewRecommendation } from "@/features/finance/recommendation-service";
import { getFinancePlan } from "@/features/finance/plan-service";
import { getSeatPrices } from "@/features/seating/prices";
import { DomainError } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createFinanceItem, setFinancePlan } from "../../helpers/finance";
import { setAllocation, setSaleSettings } from "../../helpers/seating";

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

  it("öneri kesin fiyatı, katsayıyı ve kimlik/zaman bilgisini değiştirmez", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await db.insert(eventSeatPrices).values([
      { eventId: event.id, category: "standard", coefficient: "1.500" },
      { eventId: event.id, category: "premium", coefficient: "2.000" },
      { eventId: event.id, category: "vip", coefficient: "3.250" },
    ]);
    const setter = await persistActor(db, managerActor("entertainment"));
    await saveFinalPrices(db, setter, { eventId: event.id, prices: { standard: "9000" } });
    const [before] = await db
      .select()
      .from(eventSeatPrices)
      .where(and(eq(eventSeatPrices.eventId, event.id), eq(eventSeatPrices.category, "standard")));

    await computeRecommendation(db, ent, { eventId: event.id });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.finalPrice).toBe("9000.00");
    expect(prices.standard.coefficient).toBe("1.500");
    expect(prices.premium.coefficient).toBe("2.000");
    expect(prices.vip.coefficient).toBe("3.250");
    expect(prices.standard.recommendedPrice).not.toBeNull();
    const [after] = await db
      .select()
      .from(eventSeatPrices)
      .where(and(eq(eventSeatPrices.eventId, event.id), eq(eventSeatPrices.category, "standard")));
    expect(after?.finalSetBy).toBe(setter.id);
    expect(after?.finalSetAt).toEqual(before?.finalSetAt);
  });

  it("öneri planı son değiştiren bilgisini ve updated_at değerini ezmez", async () => {
    const { event, ent } = await setup();
    const editor = await persistActor(db, managerActor("entertainment"));
    await saveFinancePlan(db, editor, {
      eventId: event.id,
      targetProfit: "20000.00",
      casinoCostMode: "free",
      casinoTransferPrice: "0.00",
    });
    const [before] = await db.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, event.id));
    await computeRecommendation(db, ent, { eventId: event.id });
    const [after] = await db.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, event.id));
    expect(after?.updatedBy).toBe(editor.id);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
    expect(after?.recommendedAt).toBeInstanceOf(Date);
  });

  it("tavsiye kilidi tutulurken eşzamanlı kalem ekleme bekler; kayıtlı öneri tutarlı kalır", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    const item = {
      eventId: event.id,
      direction: "expense" as const,
      category: "production" as const,
      label: "Ek",
      estimatedAmount: "12000.00",
      actualAmount: null,
      note: null,
    };

    let writer: Promise<unknown> | undefined;
    await db.transaction(async (tx) => {
      await lockEditableEvent(tx, event.id);
      writer = createItemService(db, ent, item);
      let done = false;
      void writer.then(() => (done = true), () => (done = true));
      await new Promise((r) => setTimeout(r, 300));
      expect(done).toBe(false);
      const view = await previewRecommendation(tx, event.id);
      expect(view.prices.standard).toBe("10000.00");
    });
    await writer;

    const after = await computeRecommendation(db, ent, { eventId: event.id });
    expect(after.assumptions.estimatedExpense).toBe("112000.00");
    expect(after.prices.standard).toBe("11200.00");
  });

  it("hesap ile eşzamanlı kalem ekleme: kayıtlı öneri iki tutarlı sonuçtan biridir", async () => {
    const { event, ent } = await setup();
    await setFinancePlan(db, event.id, { targetProfit: "20000.00" });
    await Promise.all([
      computeRecommendation(db, ent, { eventId: event.id }),
      createItemService(db, ent, {
        eventId: event.id,
        direction: "expense",
        category: "production",
        label: "Ek",
        estimatedAmount: "12000.00",
        actualAmount: null,
        note: null,
      }),
    ]);
    const prices = await getSeatPrices(db, event.id);
    expect(["10000.00", "11200.00"]).toContain(prices.standard.recommendedPrice);
    const [standard, premium] = [prices.standard.recommendedPrice, prices.premium.recommendedPrice];
    // premium katsayı 1 → aynı fiyat; karışık (biri kalemli biri kalemsiz) olamaz
    expect(premium).toBe(standard);
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
