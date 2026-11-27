import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  defaultMonth,
  groupByDateKey,
  monthParam,
  parseMonthParam,
  shiftMonth,
} from "@/components/calendar/month";

describe("calendar month", () => {
  it.each([
    ["2027-01", { year: 2027, month: 1 }],
    ["2027-13", undefined],
    ["2027-1", undefined],
    ["abc", undefined],
    [undefined, undefined],
    [["2027-01", "2027-02"], undefined],
    ["1999-01", undefined],
  ])("parseMonthParam(%o)", (raw, out) => {
    expect(parseMonthParam(raw)).toEqual(out);
  });

  it("ay kaydırma yıl sınırını geçer", () => {
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(monthParam(shiftMonth({ year: 2026, month: 12 }, 1))).toBe("2027-01");
  });

  it("Ocak 2027 ızgarası Pazartesi başlar: ilk hafta 28 Aralık–3 Ocak, beş hafta", () => {
    const grid = buildMonthGrid({ year: 2027, month: 1 });
    expect(grid).toHaveLength(5);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]![0]).toEqual({ key: "2026-12-28", day: 28, inMonth: false });
    expect(grid[0]![4]).toEqual({ key: "2027-01-01", day: 1, inMonth: true });
    expect(grid[4]![6]).toEqual({ key: "2027-01-31", day: 31, inMonth: true });
  });

  it("etkinlikler Kıbrıs gününe göre gruplanır: UTC 22:30 ertesi günün hücresindedir", () => {
    const map = groupByDateKey([
      { startsAt: "2027-01-15T18:00:00.000Z" },
      { startsAt: "2027-01-15T22:30:00.000Z" },
    ]);
    expect([...map.keys()]).toEqual(["2027-01-15", "2027-01-16"]);
  });

  it("varsayılan ay en yakın gelecek etkinliğin ayıdır; yoksa bugünün ayı", () => {
    expect(
      defaultMonth(
        [{ startsAt: "2026-11-01T18:00:00Z" }, { startsAt: "2027-01-15T18:00:00Z" }],
        "2026-11-27",
      ),
    ).toEqual({ year: 2027, month: 1 });
    expect(defaultMonth([], "2026-11-27")).toEqual({ year: 2026, month: 11 });
  });
});
