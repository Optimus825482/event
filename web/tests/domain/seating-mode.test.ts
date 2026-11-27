import { describe, expect, it } from "vitest";
import { seatNoShown, wholeOnlyOf } from "@/domain/seating";

describe("domain/seating: satış şekli kuralları", () => {
  it.each([
    [{ saleMode: "seat", sharedTables: true, isLoca: false }, false],
    [{ saleMode: "seat", sharedTables: true, isLoca: true }, true],
    [{ saleMode: "seat", sharedTables: false, isLoca: false }, true],
    [{ saleMode: "table", sharedTables: true, isLoca: false }, true],
  ] as const)("wholeOnlyOf(%o) = %s", (i, out) => {
    expect(wholeOnlyOf(i)).toBe(out);
  });

  it("sandalye numarası yalnızca sandalye bazlı kipte ve loca olmayan masada gösterilir", () => {
    expect(seatNoShown({ saleMode: "seat", isLoca: false })).toBe(true);
    expect(seatNoShown({ saleMode: "seat", isLoca: true })).toBe(false);
    expect(seatNoShown({ saleMode: "table", isLoca: false })).toBe(false);
  });
});
