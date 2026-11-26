import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventFinancePlans } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getFinancePlan, saveFinancePlan } from "@/features/finance/plan-service";
import { financePlanSchema } from "@/features/finance/schemas";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

beforeEach(async () => {
  await truncateAll();
});

function parsePlan(eventId: string, patch: Record<string, unknown> = {}) {
  return financePlanSchema.parse({
    eventId,
    targetProfit: "100",
    casinoCostMode: "free",
    casinoTransferPrice: "0",
    ...patch,
  });
}

describe("finans planı", () => {
  it("plan yokken varsayılanlar döner", async () => {
    const event = await f.createEvent(db);
    expect(await getFinancePlan(db, event.id)).toEqual({
      eventId: event.id,
      targetProfit: "0.00",
      casinoCostMode: "free",
      casinoTransferPrice: "0.00",
      recommendedAt: null,
    });
  });

  it("plan kaydedilir ve ikinci kayıt aynı satırı günceller", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    await saveFinancePlan(db, ent, parsePlan(event.id, { targetProfit: "5000" }));
    const plan = await saveFinancePlan(
      db,
      ent,
      parsePlan(event.id, { targetProfit: "7500.5", casinoCostMode: "transfer", casinoTransferPrice: "250.5" }),
    );
    expect(plan).toMatchObject({ targetProfit: "7500.50", casinoCostMode: "transfer", casinoTransferPrice: "250.50" });
    const rows = await db.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.updatedBy).toBe(ent.id);
  });

  it("plan kaydı recommended_at'i silmez", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const at = new Date("2026-11-20T10:00:00.000Z");
    await db.insert(eventFinancePlans).values({ eventId: event.id, recommendedAt: at });
    const plan = await saveFinancePlan(db, ent, parsePlan(event.id));
    expect(plan.recommendedAt?.getTime()).toBe(at.getTime());
    expect(plan.targetProfit).toBe("100.00");
  });

  it("şema: geçersiz kip ve tutar reddedilir", () => {
    const result = financePlanSchema.safeParse({
      eventId: "00000000-0000-4000-8000-000000000000",
      targetProfit: "-1",
      casinoCostMode: "x",
      casinoTransferPrice: "1.234",
    });
    expect(result.error?.issues.map((i) => i.message).sort()).toEqual(
      ["Geçersiz Casino payı seçeneği", "Tutar geçersiz", "Tutar geçersiz"].sort(),
    );
  });

  it("Casino yöneticisi planı kaydedemez → ForbiddenError", async () => {
    const event = await f.createEvent(db);
    const casino = await persistActor(db, managerActor("casino"));
    await expect(saveFinancePlan(db, casino, parsePlan(event.id))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
