import { describe, expect, it } from "vitest";
import { clockSkewMs, formatCountdown, remainingMs } from "@/features/checkout/countdown";

describe("geri sayım", () => {
  it.each([
    [599_000, "09:59"],
    [61_000, "01:01"],
    [999, "00:01"],
    [0, "00:00"],
    [600_000, "10:00"],
  ])("formatCountdown(%i) = %s", (ms, out) => expect(formatCountdown(ms)).toBe(out));

  it("kalan süre negatife düşmez", () =>
    expect(remainingMs("2026-12-01T10:00:00.000Z", Date.parse("2026-12-01T10:00:05.000Z"))).toBe(0));

  it("kalan süre sunucu saatine göre düzeltilir", () => {
    const device = Date.parse("2026-12-01T09:57:00.000Z");
    const skew = clockSkewMs("2026-12-01T10:00:00.000Z", device); // cihaz 3 dk geride
    expect(skew).toBe(180_000);
    expect(remainingMs("2026-12-01T10:10:00.000Z", device + skew)).toBe(600_000);
  });

  it("geçersiz zaman damgasında kalan süre 0", () => expect(remainingMs("bozuk", 0)).toBe(0));
});
