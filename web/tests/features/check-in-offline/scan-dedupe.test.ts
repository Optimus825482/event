import { describe, expect, it } from "vitest";
import { createScanDeduper } from "@/features/check-in/scanner/scan-dedupe";

describe("createScanDeduper", () => {
  it("aynı kodun pencere içindeki tekrar okumalarını yok sayar", () => {
    const d = createScanDeduper(3_000);
    expect(d.accept("abc", 0)).toBe(true);
    expect(d.accept("abc", 100)).toBe(false);
    expect(d.accept("abc", 2_999)).toBe(false);
  });

  it("pencere dolunca aynı kod yeniden kabul edilir", () => {
    const d = createScanDeduper(3_000);
    d.accept("abc", 0);
    expect(d.accept("abc", 3_000)).toBe(true);
  });

  it("farklı kod hemen kabul edilir, öncekini unutmaz", () => {
    const d = createScanDeduper(3_000);
    expect(d.accept("a", 0)).toBe(true);
    expect(d.accept("b", 10)).toBe(true);
    expect(d.accept("a", 20)).toBe(false);
  });

  it("reddedilen okuma pencereyi uzatmaz (kamera önünde bekleyen kod sürekli engellenmez)", () => {
    const d = createScanDeduper(3_000);
    d.accept("a", 0);
    d.accept("a", 2_000);
    expect(d.accept("a", 3_000)).toBe(true);
  });

  it("boş kodu reddeder; reset sonrası kabul eder", () => {
    const d = createScanDeduper(3_000);
    expect(d.accept("  ", 0)).toBe(false);
    d.accept("a", 0);
    d.reset();
    expect(d.accept("a", 1)).toBe(true);
  });
});
