import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/db/client";
import { eventFinanceItems, eventFinancePlans, events } from "@/db/schema";
import { FINANCE_CATEGORIES, FINANCE_DIRECTIONS } from "@/features/finance/constants";
import { pgConstraintOf } from "@/lib/pg-error";
import { inRollback } from "../../db/isolation";
import { createEvent, pgErrorCode } from "../../helpers/factories";
import { createFinanceItem, listFinanceItems, setFinancePlan } from "../../helpers/finance";

/**
 * İşlemi bir kayıt noktası içinde çalıştırır; verilen SQLSTATE ile (ve verildiyse o kısıt adıyla)
 * reddedildiğini doğrular.
 */
async function expectPgError(
  tx: Tx,
  code: string,
  op: (sp: Tx) => Promise<unknown>,
  constraint?: string,
): Promise<void> {
  let caught: unknown;
  try {
    await tx.transaction(async (sp) => {
      await op(sp);
    });
  } catch (err) {
    caught = err;
  }
  expect(caught, `beklenen hata ${code} fırlatılmadı`).toBeDefined();
  expect(pgErrorCode(caught)).toBe(code);
  if (constraint) expect(pgConstraintOf(caught)).toBe(constraint);
}

describe("finans şeması", () => {
  it("plan satırı varsayılanlarla oluşur", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      const [row] = await tx.insert(eventFinancePlans).values({ eventId: e.id }).returning();
      expect(row).toMatchObject({
        targetProfit: "0.00",
        casinoCostMode: "free",
        casinoTransferPrice: "0.00",
        recommendedAt: null,
        updatedBy: null,
      });
    });
  });

  it("etkinlik başına tek plan", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await tx.insert(eventFinancePlans).values({ eventId: e.id });
      await expectPgError(
        tx,
        "23505",
        (sp) => sp.insert(eventFinancePlans).values({ eventId: e.id }),
        "event_finance_plans_pkey",
      );
    });
  });

  it.each([
    ["negatif hedef kâr", { targetProfit: "-0.01" }, "event_finance_plans_target_non_negative"],
    ["geçersiz Casino kipi", { casinoCostMode: "percent" }, "event_finance_plans_casino_mode_valid"],
    ["negatif transfer fiyatı", { casinoTransferPrice: "-1.00" }, "event_finance_plans_transfer_price_non_negative"],
  ] as const)("plan reddi: %s → 23514", async (_name, patch, constraint) => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await expectPgError(
        tx,
        "23514",
        (sp) => sp.insert(eventFinancePlans).values({ eventId: e.id, ...(patch as Record<string, string>) }),
        constraint,
      );
    });
  });

  it("plan upsert ile güncellenir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await setFinancePlan(tx, e.id, { targetProfit: "5000.00" });
      await setFinancePlan(tx, e.id, { casinoCostMode: "transfer", casinoTransferPrice: "250.50" });
      const rows = await tx.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, e.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        targetProfit: "5000.00",
        casinoCostMode: "transfer",
        casinoTransferPrice: "250.50",
      });
    });
  });

  it("kalem: sabitlerdeki her yön ve kategori kabul edilir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      for (const direction of FINANCE_DIRECTIONS) {
        for (const category of FINANCE_CATEGORIES) {
          await createFinanceItem(tx, e.id, { direction, category });
        }
      }
      expect(await listFinanceItems(tx, e.id)).toHaveLength(14);
    });
  });

  it.each([
    ["geçersiz yön", { direction: "transfer" }, "event_finance_items_direction_valid"],
    ["geçersiz kategori", { category: "ticket_sales" }, "event_finance_items_category_valid"],
    ["negatif tahmini", { estimatedAmount: "-0.01" }, "event_finance_items_amounts_non_negative"],
    ["negatif gerçekleşen", { actualAmount: "-0.01" }, "event_finance_items_amounts_non_negative"],
  ] as const)("kalem reddi: %s → 23514", async (_name, patch, constraint) => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await expectPgError(
        tx,
        "23514",
        (sp) => createFinanceItem(sp, e.id, patch as Record<string, string>),
        constraint,
      );
    });
  });

  it("gerçekleşen tutar boş bırakılabilir ve kuruş korunur", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      const item = await createFinanceItem(tx, e.id, { estimatedAmount: "1234567.89" });
      expect(item.estimatedAmount).toBe("1234567.89");
      expect(item.actualAmount).toBeNull();
      expect(item.sortOrder).toBe(0);
      expect(item.note).toBeNull();
    });
  });

  it("kalemler sort_order, sonra oluşturulma sırasıyla listelenir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await createFinanceItem(tx, e.id, { label: "C", sortOrder: 2 });
      await createFinanceItem(tx, e.id, { label: "A", sortOrder: 1 });
      await createFinanceItem(tx, e.id, { label: "B", sortOrder: 1, createdAt: new Date(Date.now() + 1000) });
      const rows = await listFinanceItems(tx, e.id);
      expect(rows.map((r) => r.label)).toEqual(["A", "B", "C"]);
    });
  });

  it("etkinlik silinince plan ve kalemler silinir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await setFinancePlan(tx, e.id, { targetProfit: "100.00" });
      await createFinanceItem(tx, e.id);
      await createFinanceItem(tx, e.id, { direction: "income", category: "sponsorship" });
      await tx.delete(events).where(eq(events.id, e.id));
      expect(await listFinanceItems(tx, e.id)).toHaveLength(0);
      const plans = await tx.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, e.id));
      expect(plans).toHaveLength(0);
      const items = await tx.select().from(eventFinanceItems).where(eq(eventFinanceItems.eventId, e.id));
      expect(items).toHaveLength(0);
    });
  });
});
