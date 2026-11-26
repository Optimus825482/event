import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/realtime/publish", () => ({ publish: vi.fn(async () => {}) }));

import { db } from "@/db/client";
import { eventSeatPrices } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { financeActionDefs } from "@/features/finance/action-defs";
import { publish } from "@/features/realtime/publish";
import { createAction } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

function run<K extends keyof typeof financeActionDefs>(key: K, actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(financeActionDefs[key] as never) as (raw: unknown) => Promise<{
    ok: boolean;
    code?: string;
    data?: unknown;
    fieldErrors?: Record<string, string[]>;
  }>;
}

describe("finans eylemleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("eylem kapıları sözleşmedeki fiillerdir", () =>
    expect(
      Object.fromEntries(Object.entries(financeActionDefs).map(([k, d]) => [k, `${d.module}:${d.verb}`])),
    ).toEqual({
      createItem: "finance:create",
      updateItem: "finance:edit",
      deleteItem: "finance:delete",
      savePlan: "finance:edit",
      saveCoefficients: "finance:edit",
      computeRecommendation: "finance:edit",
      saveFinalPrices: "finance:edit",
    }));

  it("Casino yöneticisinin elle hazırladığı fiyat isteği forbidden döner, satır yazılmaz", async () => {
    const event = await f.createEvent(db);
    const casino = await persistActor(db, managerActor("casino"));
    const result = await run("saveFinalPrices", casino)({ eventId: event.id, prices: { standard: "100" } });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(eventSeatPrices)).toHaveLength(0);
  });

  it("geçersiz tutar alan hatası olarak döner", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const result = await run("createItem", ent)({
      eventId: event.id,
      direction: "expense",
      category: "production",
      label: "Işık",
      estimatedAmount: "abc",
      actualAmount: null,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(result.fieldErrors?.estimatedAmount).toEqual(["Tutar geçersiz"]);
  });

  it("kalem ekleme, güncelleme ve silme { id } döner", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const created = await run("createItem", ent)({
      eventId: event.id,
      direction: "expense",
      category: "production",
      label: "Işık",
      estimatedAmount: "10",
      actualAmount: null,
    });
    expect(created.ok).toBe(true);
    const { id } = created.data as { id: string };
    expect(typeof id).toBe("string");
    const updated = await run("updateItem", ent)({
      id,
      category: "marketing",
      label: "Afiş",
      estimatedAmount: "12",
      actualAmount: null,
    });
    expect(updated).toEqual({ ok: true, data: { id } });
    expect(await run("deleteItem", ent)({ id })).toEqual({ ok: true, data: { id } });
  });

  it("plan, katsayı ve tavsiye eylemleri sonuç döner", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    expect(
      await run("savePlan", ent)({
        eventId: event.id,
        targetProfit: "100",
        casinoCostMode: "free",
        casinoTransferPrice: "0",
      }),
    ).toEqual({ ok: true, data: { eventId: event.id } });
    expect(
      await run("saveCoefficients", ent)({
        eventId: event.id,
        coefficients: { standard: "1", premium: "1.5", vip: "2" },
      }),
    ).toEqual({ ok: true, data: { eventId: event.id } });
    const rec = await run("computeRecommendation", ent)({ eventId: event.id });
    expect(rec.ok).toBe(true);
    expect(rec.data).toMatchObject({ reason: "no_seats" });
  });

  it("kesin fiyat eylemi başarıda { eventId } döner", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    expect(await run("saveFinalPrices", ent)({ eventId: event.id, prices: { standard: "100" } })).toEqual({
      ok: true,
      data: { eventId: event.id },
    });
  });

  it("boş fiyat isteği alan hatası döner; servis çağrılmaz, sales.changed yayılmaz", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    vi.mocked(publish).mockClear();
    const result = await run("saveFinalPrices", ent)({ eventId: event.id, prices: {} });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(result.fieldErrors?.prices).toEqual(["En az bir fiyat girin"]);
    expect(publish).not.toHaveBeenCalled();
    expect(await db.select().from(eventSeatPrices)).toHaveLength(0);
  });

  it("oturumsuz çağrı unauthenticated döner", async () => {
    const event = await f.createEvent(db);
    expect(await run("computeRecommendation", null)({ eventId: event.id })).toMatchObject({
      ok: false,
      code: "unauthenticated",
    });
  });
});
