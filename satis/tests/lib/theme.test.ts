import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COLORS, TEXT_PAIRS, contrastRatio } from "@/lib/theme";

describe("tema", () => {
  it.each(TEXT_PAIRS)("$fg / $bg metin kontrastı en az 4.5:1", ({ fg, bg }) =>
    expect(contrastRatio(COLORS[fg], COLORS[bg])).toBeGreaterThanOrEqual(4.5),
  );
  it("çerçeve ve odak halkası zeminden en az 3:1 ayrışır", () => {
    expect(contrastRatio(COLORS.gold, COLORS.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(COLORS.gold, COLORS.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(COLORS.gold, COLORS.glass)).toBeGreaterThanOrEqual(3);
  });
  it("contrastRatio bilinen değerleri verir", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
  it("altın vurgu prototipteki tondur", () => expect(COLORS.gold).toBe("#d4af37"));
  it("globals.css her token'ı aynı değerle tanımlar", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../../src/app/globals.css"), "utf8").toLowerCase();
    for (const [name, hex] of Object.entries(COLORS)) {
      expect(css).toContain(`--color-${name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${hex}`);
    }
  });
  it("mevcut token adları korunur (P4 bileşenleri bu sınıfları kullanır)", () => {
    const kept = [
      "bg",
      "surface",
      "surfaceRaised",
      "line",
      "gold",
      "goldBright",
      "ivory",
      "muted",
      "onGold",
      "glass",
      "danger",
      "success",
      "disabledBg",
      "disabledText",
    ];
    expect(Object.keys(COLORS)).toEqual(expect.arrayContaining(kept));
  });
  it("palet bilet1 değerleridir", () => {
    expect(COLORS).toMatchObject({
      bg: "#08090d",
      surface: "#11131a",
      surfaceRaised: "#161923",
      footer: "#06070a",
      line: "#24262c",
      lineGold: "#352e16",
      gold: "#d4af37",
      goldBright: "#f0d068",
      ivory: "#f7f5f0",
      muted: "#a6aab8",
      onGold: "#08090d",
      glass: "#252013",
    });
  });
  it("alt bilgi ve parlak altın çiftleri denetim listesindedir", () => {
    const has = (fg: string, bg: string) => TEXT_PAIRS.some((p) => p.fg === fg && p.bg === bg);
    expect([
      has("muted", "footer"),
      has("goldBright", "bg"),
      has("muted", "surfaceRaised"),
      has("ivory", "footer"),
    ]).toEqual([true, true, true, true]);
  });
  it("odak halkası zeminlerden en az 3:1 ayrışır", () => {
    for (const bg of ["bg", "surface", "surfaceRaised", "footer"] as const) {
      expect(contrastRatio(COLORS.goldBright, COLORS[bg])).toBeGreaterThanOrEqual(3);
    }
  });
});
