import { describe, expect, it } from "vitest";
import { displayPnr, looksLikePnr } from "@/features/check-in/door-code";
import { PNR_LENGTH, formatPnr, generatePnr, parsePnr } from "@/features/ticketing/pnr";

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

  it.each(["Ayşe Kaya", "ayşe kaya", "Elif Önal", "OOOO1111", "ABCD-EFGI", "ABCDEFG!"])(
    "8 karakterli ama alfabe dışı girdi (%s) ad aramasıdır",
    (q) => {
      expect(q.replace(/[\s-]/g, "")).toHaveLength(PNR_LENGTH);
      expect(looksLikePnr(q)).toBe(false);
    },
  );

  it.each(["Ayşe Kaya", "ABCD-2345", "abcd 2345", "R234567", "ABCDEFGHJ", "OOOO1111", ""])(
    "looksLikePnr(%s) parsePnr ile aynı karar verir",
    (q) => {
      expect(looksLikePnr(q)).toBe(parsePnr(q) !== null);
    },
  );

  it("displayPnr formatPnr ile aynı çıktıyı verir", () => {
    const pnr = generatePnr();
    expect(displayPnr(pnr)).toBe(formatPnr(pnr));
    expect(displayPnr("kısa")).toBe("kısa");
  });
});
