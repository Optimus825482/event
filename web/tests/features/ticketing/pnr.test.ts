import { describe, expect, it } from "vitest";
import { formatPnr, generatePnr, parsePnr } from "@/features/ticketing/pnr";

describe("pnr", () => {
  it("üretilen PNR 8 karakterdir ve yalnızca kod alfabesini kullanır", () => {
    for (let i = 0; i < 200; i += 1) expect(generatePnr()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
  });
  it("gösterim XXXX-XXXX", () => expect(formatPnr("ABCD2345")).toBe("ABCD-2345"));
  it.each([
    ["abcd-2345", "ABCD2345"],
    [" abcd 2345 ", "ABCD2345"],
    ["ABCD2345", "ABCD2345"],
    ["ABCD234", null],
    ["ABCD23456", null],
    ["ABCD234O", null],
    ["ABCD234!", null],
    ["", null],
    ["R234567", null],
  ])("parsePnr(%j) = %j", (input, pnr) => expect(parsePnr(input)).toBe(pnr));
});
