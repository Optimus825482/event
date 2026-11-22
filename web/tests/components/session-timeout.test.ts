import { describe, expect, it } from "vitest";
import { MAX_TIMER_MS, WARNING_LEAD_MS, formatRemaining, msUntilWarning, parseSessionExpiry, remainingMs } from "@/components/layout/session-timeout";

describe("parseSessionExpiry", () => {
  it("ISO metni ve sayıyı okur", () => {
    expect(parseSessionExpiry({ session: { expiresAt: "2026-01-01T00:00:00.000Z" } })).toBe(Date.UTC(2026, 0, 1));
    expect(parseSessionExpiry({ session: { expiresAt: 1000 } })).toBe(1000);
  });
  it("oturum yoksa ya da biçim bozuksa null", () => {
    expect(parseSessionExpiry(null)).toBeNull();
    expect(parseSessionExpiry({ session: null })).toBeNull();
    expect(parseSessionExpiry({ session: {} })).toBeNull();
    expect(parseSessionExpiry({ session: { expiresAt: "bozuk" } })).toBeNull();
    expect(parseSessionExpiry({ session: { expiresAt: true } })).toBeNull();
  });
});

describe("msUntilWarning", () => {
  it("uyarı zamanına kadar bekler", () => {
    expect(msUntilWarning(10 * 60_000, 0)).toBe(10 * 60_000 - WARNING_LEAD_MS);
  });
  it("zaman geçmişse 0, çok uzaksa üst sınır", () => {
    expect(msUntilWarning(1000, 0)).toBe(0);
    expect(msUntilWarning(Number.MAX_SAFE_INTEGER, 0)).toBe(MAX_TIMER_MS);
  });
});

describe("remainingMs / formatRemaining", () => {
  it("negatif olmaz", () => {
    expect(remainingMs(100, 500)).toBe(0);
    expect(remainingMs(500, 100)).toBe(400);
  });
  it("dakika:saniye biçimi", () => {
    expect(formatRemaining(247_000)).toBe("4:07");
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(-5)).toBe("0:00");
    expect(formatRemaining(1)).toBe("0:01");
  });
});
