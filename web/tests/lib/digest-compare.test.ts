import { describe, expect, it } from "vitest";
import { byLabel } from "@/lib/compare";
import { sha256, sha256Hex } from "@/lib/digest";

describe("sha256 yardımcıları", () => {
  it("bilinen özet; ham bayt ve onaltılık aynı değeri verir", () => {
    const hex = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(sha256Hex("abc")).toBe(hex);
    expect(sha256("abc").toString("hex")).toBe(hex);
    expect(sha256("abc")).toHaveLength(32);
  });

  it("UTF-8 olarak özetlenir", () => {
    expect(sha256Hex("ş")).not.toBe(sha256Hex("s"));
  });
});

describe("byLabel", () => {
  it("sayılar sayısal sıralanır, Türkçe harf sırası kullanılır", () => {
    expect(["M10", "M2", "M1"].sort(byLabel)).toEqual(["M1", "M2", "M10"]);
    expect(["Z1", "Ç1", "C1"].sort(byLabel)).toEqual(["C1", "Ç1", "Z1"]);
  });
});
