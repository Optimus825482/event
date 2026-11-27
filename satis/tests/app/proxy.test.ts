import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "../../next.config";
import { config, proxy } from "@/proxy";

// Next eşleştiricisinin davranışı: "/(...)" kalıbının içi yolun tamamına uygulanır.
const inner = (config.matcher[0] as string).slice(2, -1);
const matches = (pathname: string) => new RegExp(`^/${inner}$`).test(pathname);

describe("proxy matcher", () => {
  it.each(["/odeme/abc.def", "/bilet/x.y", "/bilet/AbC123.xyz789", "/biletimi-bul", "/", "/etkinlik/x"])(
    "%s proxy'den geçer",
    (p) => expect(matches(p)).toBe(true),
  );
  it.each(["/api/health", "/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"])("%s dışlanır", (p) =>
    expect(matches(p)).toBe(false),
  );
  it("yazı tipi dosyaları proxy'den geçmez", () => expect(matches("/fonts/dm-sans-latin-wght-normal.woff2")).toBe(false));
  it.each(["/etkinlikler", "/takvim", "/hakkimizda"])("%s proxy'den geçer", (p) => expect(matches(p)).toBe(true));
});

describe("proxy", () => {
  it("belirteçli yolda CSP, noindex ve no-store ekler", () => {
    const res = proxy(new NextRequest("http://localhost:3370/odeme/abc.def"));
    expect(res.headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("herkese açık yola noindex eklemez", () => {
    const res = proxy(new NextRequest("http://localhost:3370/etkinlik/x"));
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });
});

describe("next.config headers() yedeği", () => {
  it.each(["/odeme/:path*", "/bilet/:path*", "/biletimi-bul"])("%s noindex ve no-store taşır", async (source) => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === source);
    expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    expect(rule?.headers).toContainEqual({ key: "Cache-Control", value: "no-store" });
  });
  it("/fonts/:path* uzun ömürlü önbellek başlığı taşır", async () => {
    const rule = (await nextConfig.headers!()).find((r) => r.source === "/fonts/:path*");
    expect(rule?.headers).toContainEqual({ key: "Cache-Control", value: "public, max-age=2592000" });
  });
});
