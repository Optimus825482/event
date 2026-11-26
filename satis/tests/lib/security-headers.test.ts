import { describe, expect, it } from "vitest";
import { isPrivatePath, privateHeaders, securityHeaders } from "@/lib/security-headers";

describe("güvenlik başlıkları", () => {
  it("site genelinde no-referrer, çerçeve yasağı; HSTS yalnızca üretimde", () => {
    const dev = securityHeaders(false);
    const prod = securityHeaders(true);
    expect(dev).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
    expect(dev).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(dev).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(dev.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    expect(prod.some((h) => h.key === "Strict-Transport-Security")).toBe(true);
  });
  it.each([
    ["/odeme/abc.def", true],
    ["/bilet/abc.def", true],
    ["/biletimi-bul", true],
    ["/", false],
    ["/etkinlik/x", false],
    ["/biletler", false],
    ["/kvkk", false],
  ])("isPrivatePath(%s) = %s", (p, out) => expect(isPrivatePath(p)).toBe(out));
  it("belirteçli sayfalar noindex ve no-store alır", () =>
    expect(privateHeaders()).toEqual([
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "no-store" },
    ]));
});
