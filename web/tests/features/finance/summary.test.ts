import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { getFinanceItems, getFinanceSummary } from "@/features/finance/queries";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createFinanceItem, setFinancePlan } from "../../helpers/finance";
import { setSaleSettings } from "../../helpers/seating";

beforeEach(async () => {
  await truncateAll();
});

describe("getFinanceSummary", () => {
  it("özet: yön bazında toplamlar, gerçekleşen yalnızca girilenlerden", async () => {
    const event = await f.createEvent(db);
    await createFinanceItem(db, event.id, { estimatedAmount: "100000.10" });
    await createFinanceItem(db, event.id, { estimatedAmount: "0.20", actualAmount: "5.00" });
    await createFinanceItem(db, event.id, { direction: "income", category: "sponsorship", estimatedAmount: "20000.00" });
    expect(await getFinanceSummary(db, event.id)).toMatchObject({
      estimatedExpense: "100000.30",
      actualExpense: "5.00",
      estimatedOtherIncome: "20000.00",
      actualOtherIncome: "0.00",
    });
  });

  it("kalemsiz etkinlikte toplamlar '0.00', artistFee null, currency satış ayarından", async () => {
    const event = await f.createEvent(db);
    expect(await getFinanceSummary(db, event.id)).toMatchObject({
      currency: "TRY",
      estimatedExpense: "0.00",
      actualExpense: "0.00",
      estimatedOtherIncome: "0.00",
      actualOtherIncome: "0.00",
      artistFee: null,
      targetProfit: "0.00",
      casinoCostMode: "free",
      casinoTransferPrice: "0.00",
      items: [],
    });
    await setSaleSettings(db, event.id, { currency: "EUR" });
    expect((await getFinanceSummary(db, event.id)).currency).toBe("EUR");
  });

  it("artistFee: gerçekleşen varsa o, yoksa tahmini; gelir kalemi sayılmaz", async () => {
    const event = await f.createEvent(db);
    await createFinanceItem(db, event.id, { category: "artist_fee", estimatedAmount: "50000.00", actualAmount: "55000.00" });
    await createFinanceItem(db, event.id, { category: "artist_fee", estimatedAmount: "10000.00" });
    await createFinanceItem(db, event.id, { direction: "income", category: "other", estimatedAmount: "999.00" });
    expect((await getFinanceSummary(db, event.id)).artistFee).toBe("65000.00");
  });

  it("plan alanları özete yansır ve kalemler ekleme sırasıyla gelir", async () => {
    const event = await f.createEvent(db);
    await setFinancePlan(db, event.id, {
      targetProfit: "30000.00",
      casinoCostMode: "transfer",
      casinoTransferPrice: "150.00",
    });
    const a = await createFinanceItem(db, event.id, { label: "A", sortOrder: 1 });
    const b = await createFinanceItem(db, event.id, { label: "B", sortOrder: 2 });
    const summary = await getFinanceSummary(db, event.id);
    expect(summary).toMatchObject({
      targetProfit: "30000.00",
      casinoCostMode: "transfer",
      casinoTransferPrice: "150.00",
    });
    expect(summary.items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(summary.items[0]).toEqual({
      id: a.id,
      direction: "expense",
      category: "production",
      label: "A",
      estimatedAmount: "1000.00",
      actualAmount: null,
    });
  });

  it("başka etkinliğin kalemleri karışmaz", async () => {
    const event = await f.createEvent(db);
    const other = await f.createEvent(db);
    await createFinanceItem(db, other.id, { estimatedAmount: "777.00" });
    expect((await getFinanceSummary(db, event.id)).estimatedExpense).toBe("0.00");
  });
});

describe("getFinanceItems", () => {
  it("getFinanceItems not ve sırayı taşır", async () => {
    const event = await f.createEvent(db);
    const b = await createFinanceItem(db, event.id, { label: "B", sortOrder: 2, note: "ikinci" });
    const a = await createFinanceItem(db, event.id, { label: "A", sortOrder: 1, note: "birinci" });
    const items = await getFinanceItems(db, event.id);
    expect(items.map((i) => [i.id, i.note])).toEqual([
      [a.id, "birinci"],
      [b.id, "ikinci"],
    ]);
  });
});
