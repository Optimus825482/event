import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, normalizeCode, randomBookingCode, randomCode } from "@/lib/short-code";

describe("kısa kod", () => {
  it("alfabe karışan karakterleri içermez", () => expect(CODE_ALPHABET).toBe("23456789ABCDEFGHJKLMNPQRSTUVWXYZ"));

  it("randomCode istenen uzunlukta ve alfabeden üretir", () => {
    const codes = Array.from({ length: 200 }, () => randomCode(8));
    for (const c of codes) expect(c).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(new Set(codes).size).toBe(200);
  });

  it("rezervasyon kodu R ile başlar ve 7 karakterdir", () => expect(randomBookingCode()).toMatch(/^R[2-9A-HJ-NP-Z]{6}$/));

  it.each([
    [" r7k-2m9 q ", "R7K2M9Q"],
    ["R7K2M9Q", "R7K2M9Q"],
    ["RO7K2M9", ""],
    ["R17K2M9", ""],
    ["", ""],
  ])("normalizeCode(%j) = %j", (input, out) => expect(normalizeCode(input)).toBe(out));
});
