import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getFinanceOverview } from "@/features/finance/overview";
import { assistantActor, managerActor, memberActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createFinanceItem, setFinancePlan } from "../../helpers/finance";
import { setFinalPrices } from "../../helpers/seating";

async function setup() {
  const event = await f.createEvent(db, { name: "Gala" });
  await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online", capacity: 8 });
  await f.createTable(db, event.id, { saleCategory: "premium", allocation: "online", capacity: 4 });
  await createFinanceItem(db, event.id, {
    direction: "expense",
    category: "production",
    label: "Işık",
    estimatedAmount: "5000.00",
    note: "Not var",
  });
  await setFinancePlan(db, event.id, { targetProfit: "1000.00" });
  return event;
}

describe("getFinanceOverview", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("genel bakış: özet, kalemler (not dahil), plan, sandalyeler, eksik fiyatlar ve izinler", async () => {
    const event = await setup();
    const ent = await persistActor(db, managerActor("entertainment"));
    const o = await getFinanceOverview(db, ent, event.id);
    expect(o.event).toMatchObject({ id: event.id, name: "Gala", status: event.status, planningStage: event.planningStage });
    expect(o.currency).toBe("TRY");
    expect(o.summary.estimatedExpense).toBe("5000.00");
    expect(o.items).toHaveLength(1);
    expect(o.items[0]).toMatchObject({ label: "Işık", note: "Not var", actualAmount: null });
    expect(o.plan).toEqual({
      targetProfit: "1000.00",
      casinoCostMode: "free",
      casinoTransferPrice: "0.00",
      recommendedAt: null,
    });
    expect(o.seats).toEqual({ standard: 8, premium: 4, vip: 0 });
    expect(o.seatPrices.standard).toEqual({ finalPrice: null, recommendedPrice: null, coefficient: "1.000" });
    expect(o.missingFinalPrice).toEqual(["standard", "premium"]);
    expect(o.pricesLocked).toBe(false);
    expect(o.permissions).toEqual({ create: true, edit: true, delete: true });
  });

  it("kesin fiyatı girilen kategori eksik listesinden çıkar", async () => {
    const event = await setup();
    await setFinalPrices(db, event.id, { standard: "100.00" });
    const ent = await persistActor(db, managerActor("entertainment"));
    expect((await getFinanceOverview(db, ent, event.id)).missingFinalPrice).toEqual(["premium"]);
  });

  it("Yönetici Asistanı silemez; 'v---' kullanıcı yalnızca görür", async () => {
    const event = await setup();
    const assistant = await persistActor(db, assistantActor("entertainment"));
    expect((await getFinanceOverview(db, assistant, event.id)).permissions).toEqual({
      create: true,
      edit: true,
      delete: false,
    });
    const viewer = await persistActor(db, memberActor("entertainment", { finance: "v---" }));
    expect((await getFinanceOverview(db, viewer, event.id)).permissions).toEqual({
      create: false,
      edit: false,
      delete: false,
    });
  });

  it.each([
    ["F&B yöneticisi", () => managerActor("fnb")],
    ["Casino yöneticisi", () => managerActor("casino")],
    [
      "finance izni olmayan Entertainment kullanıcısı",
      () => memberActor("entertainment", { events: "vce-", ticketing: "vce-" }),
    ],
    ["üyeliksiz kullanıcı", () => noAccessActor()],
  ])("%s ekranı göremez → ForbiddenError", async (_name, make) => {
    const event = await setup();
    await expect(getFinanceOverview(db, make(), event.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("olmayan etkinlik → not_found", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    await expect(getFinanceOverview(db, ent, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });

  it("iptal edilmiş etkinlikte pricesLocked true", async () => {
    const event = await setup();
    await db.update(events).set({ status: "cancelled" }).where(eq(events.id, event.id));
    const ent = await persistActor(db, managerActor("entertainment"));
    expect((await getFinanceOverview(db, ent, event.id)).pricesLocked).toBe(true);
  });
});
