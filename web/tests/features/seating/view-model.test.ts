import { describe, expect, it } from "vitest";
import { SALE_CATEGORIES, TABLE_ALLOCATIONS } from "@/domain/seating";
import type { SeatingTable } from "@/features/seating/queries";
import {
  ALLOCATION_COLORS,
  CATEGORY_COLORS,
  parseSellableInput,
  parseWholeNumber,
  planColors,
  saleMoveBlocker,
  seatingTotals,
} from "@/features/seating/view-model";

const HEX = /^#[0-9a-f]{6}$/i;

const t = (o: Partial<SeatingTable>): SeatingTable => ({
  id: "x",
  label: "X",
  capacity: 8,
  sellableSeats: null,
  effectiveSellable: 8,
  category: "standard",
  allocation: "pending",
  isLoca: false,
  hasActiveReservation: false,
  ...o,
});

describe("masalar ve satış görünüm modeli", () => {
  it("seatingTotals tahsise ve kategoriye göre masa ve sandalye toplar", () => {
    const totals = seatingTotals([
      t({ allocation: "online", category: "vip", effectiveSellable: 6 }),
      t({ allocation: "online" }),
      t({ allocation: "casino", category: "vip" }),
      t({ allocation: "pending", category: "premium" }),
      t({ allocation: "closed" }),
    ]);
    expect(totals.byAllocation).toEqual({
      pending: { tables: 1, seats: 8 },
      casino: { tables: 1, seats: 8 },
      online: { tables: 2, seats: 14 },
      closed: { tables: 1, seats: 8 },
    });
    expect(totals.byCategory).toEqual({
      standard: { tables: 1, seats: 8 },
      premium: { tables: 1, seats: 8 },
      vip: { tables: 1, seats: 6 },
    });
  });

  it("seatingTotals boş listede tüm sayaçları sıfır verir", () => {
    const totals = seatingTotals([]);
    for (const a of TABLE_ALLOCATIONS) expect(totals.byAllocation[a]).toEqual({ tables: 0, seats: 0 });
    for (const c of SALE_CATEGORIES) expect(totals.byCategory[c]).toEqual({ tables: 0, seats: 0 });
  });

  it.each([
    [{ allocation: "casino" }, "online", true, "Casino'ya ayrılmış"],
    [{ allocation: "casino" }, "closed", true, "Casino'ya ayrılmış"],
    [{ allocation: "pending", isLoca: true }, "online", false, "Localar online satışa kapalı"],
    [{ allocation: "pending", isLoca: true }, "online", true, null],
    [{ allocation: "pending", isLoca: true }, "closed", false, null],
    [{ allocation: "online" }, "online", true, "Zaten bu durumda"],
    [{ allocation: "online" }, "pending", true, null],
  ] as const)("saleMoveBlocker(%j, %s, locaOnline %s) = %j", (o, move, locaOnline, expected) =>
    expect(saleMoveBlocker(t(o), move, { locaOnline })).toBe(expected),
  );

  it("planColors seçilen kipe göre her masaya geçerli bir renk verir", () => {
    const tables = [
      t({ id: "a", allocation: "online", category: "vip" }),
      t({ id: "b", allocation: "casino", category: "premium" }),
      t({ id: "c", allocation: "closed" }),
      t({ id: "d", allocation: "pending" }),
    ];
    const byAllocation = planColors(tables, "allocation");
    const byCategory = planColors(tables, "category");
    for (const table of tables) {
      expect(byAllocation[table.id]).toMatch(HEX);
      expect(byAllocation[table.id]).toBe(ALLOCATION_COLORS[table.allocation]);
      expect(byCategory[table.id]).toMatch(HEX);
      expect(byCategory[table.id]).toBe(CATEGORY_COLORS[table.category]);
    }
  });

  it("renk sözlükleri her tahsis ve kategori için ayrı geçerli renk içerir", () => {
    expect(new Set(TABLE_ALLOCATIONS.map((a) => ALLOCATION_COLORS[a])).size).toBe(TABLE_ALLOCATIONS.length);
    expect(new Set(SALE_CATEGORIES.map((c) => CATEGORY_COLORS[c])).size).toBe(SALE_CATEGORIES.length);
    for (const color of [...Object.values(ALLOCATION_COLORS), ...Object.values(CATEGORY_COLORS)]) {
      expect(color).toMatch(HEX);
    }
  });

  it.each([
    ["12", 12],
    [" 7 ", 7],
    ["", undefined],
    ["abc", undefined],
    ["1.5", undefined],
    ["-3", undefined],
  ] as const)("parseWholeNumber(%j) = %j", (text, expected) => expect(parseWholeNumber(text)).toBe(expected));

  it("parseSellableInput boş metni \"tümü\" (null) sayar, aralık dışını Türkçe mesajla reddeder", () => {
    expect(parseSellableInput("", 8)).toEqual({ ok: true, value: null });
    expect(parseSellableInput(" 6 ", 8)).toEqual({ ok: true, value: 6 });
    expect(parseSellableInput("8", 8)).toEqual({ ok: true, value: 8 });
    expect(parseSellableInput("9", 8)).toEqual({ ok: false, message: "1 ile 8 arasında bir sayı girin" });
    expect(parseSellableInput("0", 8)).toEqual({ ok: false, message: "1 ile 8 arasında bir sayı girin" });
    expect(parseSellableInput("x", 8)).toEqual({ ok: false, message: "1 ile 8 arasında bir sayı girin" });
  });
});
