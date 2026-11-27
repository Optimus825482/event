import { describe, expect, it } from "vitest";
import { normalizeSightlineLabel, resolveTableSightlineSrc, sightlineSrc } from "@/features/plan/sightline";

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

  describe("normalizeSightlineLabel", () => {
    it.each([
      ["M-12", false, "M-12"],
      ["  L-3A  ", true, "L-3A"],
      ["12", false, "M-12"],
      ["3a", true, "L-3A"],
      ["Masa 12", false, "M-12"],
      ["masa 4b", false, "M-4B"],
      ["LOCA 3a", true, "L-3A"],
      ["Masa M-12", false, "M-12"],
      ["loca l-2", true, "L-2"],
    ] as const)("normalizeSightlineLabel(%s, %s) = %s", (label, isLoca, expected) => {
      expect(normalizeSightlineLabel(label, isLoca)).toBe(expected);
    });

    it.each([
      ["A1", false],
      ["1234", false],
      ["M-1234", true],
      ["../overview", false],
      ["M-12.webp", false],
      ["", false],
      ["Masa ", false],
    ] as const)("geçersiz etiket (%s) için null döner", (label, isLoca) => {
      expect(normalizeSightlineLabel(label, isLoca)).toBeNull();
    });
  });

  describe("resolveTableSightlineSrc", () => {
    it("set null ise null döner", () => {
      expect(resolveTableSightlineSrc(null, null)).toBeNull();
      expect(resolveTableSightlineSrc(null, { label: "M-12", isLoca: false })).toBeNull();
    });

    it("table null ise overview.webp döner", () => {
      expect(resolveTableSightlineSrc("diamond", null)).toBe("/sightline/diamond/overview.webp");
    });

    it("normalleştirilmiş masa ve loca etiketleri için yol üretir", () => {
      expect(resolveTableSightlineSrc("diamond", { label: "Masa 12", isLoca: false })).toBe(
        "/sightline/diamond/M-12.webp",
      );
      expect(resolveTableSightlineSrc("diamond", { label: "3a", isLoca: true })).toBe(
        "/sightline/diamond/L-3A.webp",
      );
      expect(resolveTableSightlineSrc("diamond", { label: "A1", isLoca: false })).toBeNull();
    });
  });
});
