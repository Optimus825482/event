import { describe, expect, it } from "vitest";
import { displayPnr, looksLikePnr } from "@/features/check-in/door-code";
import { PNR_LENGTH, formatPnr, generatePnr } from "@/features/ticketing/pnr";

describe("kapı kodu tanıma", () => {
  it("looksLikePnr üretilen PNR'ı her yazımda tanır", () => {
    const pnr = generatePnr();
    expect(pnr).toHaveLength(PNR_LENGTH);
    for (const v of [pnr, formatPnr(pnr), pnr.toLowerCase(), ` ${pnr.slice(0, 4)} ${pnr.slice(4)} `]) {
      expect(looksLikePnr(v)).toBe(true);
    }
  });

  it.each(["R234567", "Ali", "", "ABCDEFGHJ"])("looksLikePnr(%s) = false", (q) => {
    expect(looksLikePnr(q)).toBe(false);
  });

  it("displayPnr formatPnr ile aynı çıktıyı verir", () => {
    const pnr = generatePnr();
    expect(displayPnr(pnr)).toBe(formatPnr(pnr));
    expect(displayPnr("kısa")).toBe("kısa");
  });
});
