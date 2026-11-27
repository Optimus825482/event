import { describe, expect, it } from "vitest";
import { sightlineSrc } from "@/features/plan/sightline";

describe("sightline", () => {
  it.each([
    ["M-12", "/sightline/diamond/M-12.webp"],
    ["L-3A", "/sightline/diamond/L-3A.webp"],
    [null, "/sightline/diamond/overview.webp"],
  ] as const)("sightlineSrc(diamond, %s) = %s", (label, out) => {
    expect(sightlineSrc("diamond", label)).toBe(out);
  });

  it.each(["A1", "12", "m-12", "M-1234", "M-12/../x", "../overview", "M-12.webp", "", " M-12"])(
    "kurala uymayan etiket (%s) için yol üretilmez",
    (label) => {
      expect(sightlineSrc("diamond", label)).toBeNull();
    },
  );

  it("set boşsa hiçbir etiket için yol yoktur", () => {
    expect(sightlineSrc(null, "M-12")).toBeNull();
    expect(sightlineSrc(null, null)).toBeNull();
  });
});
