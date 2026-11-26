import { describe, expect, it } from "vitest";
import { formatPnr } from "@/features/ticket/pnr";

describe("formatPnr", () => {
  it.each([
    ["ABCD2345", "ABCD-2345"],
    ["ABC", "ABC"],
    ["", ""],
    ["ABCD23456", "ABCD23456"],
  ])("formatPnr(%s) = %s", (input, output) => {
    expect(formatPnr(input)).toBe(output);
  });
});
