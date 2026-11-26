import { describe, expect, it } from "vitest";
import { HIGHLIGHT_COLOR } from "@/features/find-table/highlight";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("masa vurgu rengi kontrastı", () => {
  it("beyaz etiketle en az 4,5:1", () => expect(ratio("#ffffff", HIGHLIGHT_COLOR)).toBeGreaterThanOrEqual(4.5));
  it("slate-900 plan zeminine karşı en az 3:1", () => expect(ratio(HIGHLIGHT_COLOR, "#0f172a")).toBeGreaterThanOrEqual(3));
});
