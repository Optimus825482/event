import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/publish", () => ({ publishNotifications: vi.fn(async () => {}) }));

import { db } from "@/db/client";
import { events } from "@/db/schema";
import { checkPreconditions } from "@/features/planning/preconditions";
import { transitionStage } from "@/features/planning/stage-service";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setStage } from "../../helpers/planning";
import { setFinalPrices } from "../../helpers/seating";

const MISSING = (labels: string) => `Kesin fiyatı girilmemiş kategori var: ${labels}`;

async function priced(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  return checkPreconditions(db, event!, "priced");
}

describe("'Fiyatlandı' önkoşulu", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yalnızca Casino masası olan etkinlikte önkoşul yok", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id);
    expect(await priced(event.id)).toEqual([]);
  });

  it("satılabilir masası olan fiyatsız kategoriler sabit sırayla adlandırılır", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "vip", allocation: "pending" });
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online" });
    expect(await priced(event.id)).toEqual([MISSING("Standart, VIP")]);
  });

  it("fiyatı girilen kategori listeden düşer; hepsi girilince boş", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "vip", allocation: "pending" });
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online" });
    await setFinalPrices(db, event.id, { standard: "100.00" });
    expect(await priced(event.id)).toEqual([MISSING("VIP")]);
    await setFinalPrices(db, event.id, { vip: "300.00" });
    expect(await priced(event.id)).toEqual([]);
  });

  it("closed masa fiyat gerektirmez; loca pending iken fiyat gerektirir", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "premium", allocation: "closed" });
    expect(await priced(event.id)).toEqual([]);
    await f.createTable(db, event.id, { saleCategory: "vip", allocation: "pending", isLoca: true });
    expect(await priced(event.id)).toEqual([MISSING("VIP")]);
  });

  it("transitionStage: fiyat eksikken 'Fiyatlandı' reddedilir, aşama değişmez", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online" });
    await setStage(db, event.id, "casino_allocated");
    const ent = await persistActor(db, managerActor("entertainment"));
    await expect(
      transitionStage(db, ent, { eventId: event.id, kind: "advance", expected: "casino_allocated" }),
    ).rejects.toMatchObject({ code: "conflict", message: MISSING("Standart") });
    const [row] = await db.select({ s: events.planningStage }).from(events).where(eq(events.id, event.id));
    expect(row?.s).toBe("casino_allocated");
  });

  it("fiyatlar girilince 'Fiyatlandı' geçer", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online" });
    await setFinalPrices(db, event.id, { standard: "100.00" });
    await setStage(db, event.id, "casino_allocated");
    const ent = await persistActor(db, managerActor("entertainment"));
    const r = await transitionStage(db, ent, { eventId: event.id, kind: "advance", expected: "casino_allocated" });
    expect(r.stage).toBe("priced");
  });

  it("'Fiyatlandı'dan geri alma fiyata bakmaz", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online" });
    await setStage(db, event.id, "priced");
    const ent = await persistActor(db, managerActor("entertainment"));
    const r = await transitionStage(db, ent, { eventId: event.id, kind: "revert", expected: "priced", note: "x" });
    expect(r.stage).toBe("casino_allocated");
  });
});
