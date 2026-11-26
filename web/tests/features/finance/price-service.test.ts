import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/realtime/publish", () => ({ publish: vi.fn(async () => {}) }));

import { db } from "@/db/client";
import { eventSeatPrices } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { coefficientsSchema, finalPricesSchema } from "@/features/finance/price-schemas";
import { saveCoefficients, saveFinalPrices } from "@/features/finance/price-service";
import { publish } from "@/features/realtime/publish";
import { getSeatPrices } from "@/features/seating/prices";
import { DomainError } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setStage } from "../../helpers/planning";
import { setFinalPrices } from "../../helpers/seating";

const coefs = { standard: "1", premium: "1.5", vip: "2.25" };

describe("kesin fiyat ve katsayı", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(publish).mockClear();
  });

  it("kesin fiyat kaydedilir: kanonik tutar, kim ve ne zaman", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    await saveFinalPrices(db, ent, { eventId: event.id, prices: { standard: "1500", vip: "4000.5" } });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.finalPrice).toBe("1500.00");
    expect(prices.vip.finalPrice).toBe("4000.50");
    expect(prices.premium.finalPrice).toBeNull();
    const [row] = await db.select().from(eventSeatPrices).where(eq(eventSeatPrices.category, "standard"));
    expect(row?.finalSetBy).toBe(ent.id);
    expect(row?.finalSetAt).toBeInstanceOf(Date);
  });

  it("verilmeyen kategori dokunulmadan kalır", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    await saveFinalPrices(db, ent, { eventId: event.id, prices: { premium: "2000" } });
    await saveFinalPrices(db, ent, { eventId: event.id, prices: { standard: "1000" } });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.premium.finalPrice).toBe("2000.00");
    expect(prices.standard.finalPrice).toBe("1000.00");
  });

  it("kesin fiyat kaydı katsayıyı ve kayıtlı öneriyi değiştirmez", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    await db
      .insert(eventSeatPrices)
      .values({ eventId: event.id, category: "standard", coefficient: "1.500", recommendedPrice: "1234.00" });
    await saveFinalPrices(db, ent, { eventId: event.id, prices: { standard: "1500" } });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.coefficient).toBe("1.500");
    expect(prices.standard.recommendedPrice).toBe("1234.00");
    expect(prices.standard.finalPrice).toBe("1500.00");
  });

  it("katsayı kaydı kesin fiyatı ve öneriyi değiştirmez", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    await setFinalPrices(db, event.id, { standard: "1500.00" });
    await db
      .update(eventSeatPrices)
      .set({ recommendedPrice: "1234.00" })
      .where(eq(eventSeatPrices.eventId, event.id));
    await saveCoefficients(db, ent, { eventId: event.id, coefficients: coefs });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.standard.finalPrice).toBe("1500.00");
    expect(prices.standard.recommendedPrice).toBe("1234.00");
    expect(prices.standard.coefficient).toBe("1.000");
    expect(prices.premium.coefficient).toBe("1.500");
    expect(prices.vip.coefficient).toBe("2.250");
    expect(prices.vip.finalPrice).toBeNull();
  });

  it.each([
    ["0", "Fiyat 0'dan büyük olmalı"],
    ["0.00", "Fiyat 0'dan büyük olmalı"],
    ["-10", "Tutar geçersiz"],
    ["12,5", "Tutar geçersiz"],
  ])("fiyat reddi %s", (value, message) => {
    const r = finalPricesSchema.safeParse({ eventId: crypto.randomUUID(), prices: { standard: value } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(message);
  });

  it("boş fiyat kümesi reddedilir", () => {
    const r = finalPricesSchema.safeParse({ eventId: crypto.randomUUID(), prices: {} });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]).toMatchObject({ message: "En az bir fiyat girin", path: ["prices"] });
    }
  });

  it("fiyat kanonik 2 ondalığa çevrilir", () => {
    const r = finalPricesSchema.parse({ eventId: crypto.randomUUID(), prices: { standard: "1500", vip: "4000.5" } });
    expect(r.prices).toEqual({ standard: "1500.00", vip: "4000.50" });
  });

  it.each([
    ["0", "Katsayı 0'dan büyük olmalı"],
    ["1.2345", "Katsayı geçersiz"],
    ["1000", "Katsayı geçersiz"],
  ])("katsayı reddi %s", (value, message) => {
    const r = coefficientsSchema.safeParse({ eventId: crypto.randomUUID(), coefficients: { ...coefs, standard: value } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(message);
  });

  it("satıştayken fiyat değişir ve sales.changed yayılır", async () => {
    const event = await f.createEvent(db);
    await setStage(db, event.id, "on_sale");
    const ent = await persistActor(db, managerActor("entertainment"));
    await saveFinalPrices(db, ent, { eventId: event.id, prices: { standard: "900" } });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(vi.mocked(publish).mock.calls[0]?.[1]).toEqual({ type: "sales.changed", eventId: event.id });
    expect((await getSeatPrices(db, event.id)).standard.finalPrice).toBe("900.00");
  });

  it("tamamlanmış etkinlikte fiyat ve katsayı yazılamaz", async () => {
    const event = await f.createEvent(db, { status: "completed" });
    const ent = await persistActor(db, managerActor("entertainment"));
    const message = "Tamamlanmış veya iptal edilmiş etkinliğin fiyatı değiştirilemez";
    await expect(saveFinalPrices(db, ent, { eventId: event.id, prices: { standard: "10" } })).rejects.toMatchObject({
      code: "conflict",
      message,
    });
    await expect(saveCoefficients(db, ent, { eventId: event.id, coefficients: coefs })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(await db.select().from(eventSeatPrices)).toHaveLength(0);
  });

  it("olmayan etkinlik not_found", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    await expect(
      saveFinalPrices(db, ent, { eventId: crypto.randomUUID(), prices: { standard: "10" } }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("yetki: finance izni olmayanlar kaydedemez", async () => {
    const event = await f.createEvent(db);
    const input = { eventId: event.id, prices: { standard: "10" } };
    for (const actor of [
      managerActor("fnb"),
      managerActor("casino"),
      memberActor("entertainment", { finance: "v---" }),
    ]) {
      await expect(saveFinalPrices(db, await persistActor(db, actor), input)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.select().from(eventSeatPrices)).toHaveLength(0);
    const member = await persistActor(db, memberActor("entertainment", { finance: "v-e-" }));
    await saveFinalPrices(db, member, input);
    expect((await getSeatPrices(db, event.id)).standard.finalPrice).toBe("10.00");
  });
});
