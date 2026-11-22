import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "@/lib/security-headers";

function toMap(entries: { key: string; value: string }[]): Map<string, string> {
  return new Map(entries.map((entry) => [entry.key, entry.value]));
}

describe("securityHeaders", () => {
  it("temel başlıkları içerir; kameraya yalnızca kendi kaynağı erişir", () => {
    const map = toMap(securityHeaders(false));
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    const permissions = map.get("Permissions-Policy") ?? "";
    expect(permissions).toContain("camera=(self)");
    expect(permissions).toContain("microphone=()");
  });

  it("HSTS yalnızca üretimde gönderilir", () => {
    expect(toMap(securityHeaders(false)).has("Strict-Transport-Security")).toBe(false);
    expect(toMap(securityHeaders(true)).get("Strict-Transport-Security")).toMatch(/^max-age=\d+/);
  });
});

describe("next.config", () => {
  it("başlıkları her yola uygular, service worker kuralını korur ve X-Powered-By'ı kapatır", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((rule) => rule.source === "/:path*")?.headers.map((h) => h.key)).toContain("X-Frame-Options");
    expect(rules.some((rule) => rule.source.includes("sw"))).toBe(true);
  });
});
