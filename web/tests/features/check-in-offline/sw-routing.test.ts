import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Strategy = "bypass" | "cache-first" | "network-first-shell" | "purge-shell";
type Input = {
  method: string;
  url: string;
  mode?: string;
  origin?: string;
  headers?: Record<string, string>;
};
type Routing = {
  decide(input: Input): Strategy;
  isWarmable(url: string, origin: string): boolean;
};

// Gerçek service worker dosyası (`public/sw-routing.js`) olduğu gibi çalıştırılır: tek kaynak.
function loadRouting(): Routing {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../../public/sw-routing.js"), "utf8");
  const self: { efRouting?: Routing } = {};
  vm.runInNewContext(source, { self, URL });
  if (!self.efRouting) throw new Error("sw-routing.js efRouting tanımlamıyor");
  return self.efRouting;
}

const routing = loadRouting();
const ORIGIN = "https://kapi.example.com";
const EVENT = "11111111-1111-4111-8111-111111111111";

function decide(over: Partial<Input> & { url: string }): Strategy {
  return routing.decide({ method: "GET", mode: "same-origin", origin: ORIGIN, ...over, url: `${ORIGIN}${over.url}` });
}

describe("service worker yönlendirmesi: asla önbelleğe alınmayanlar", () => {
  it.each([
    ["/api/check-in", "GET"],
    ["/api/check-in", "POST"],
    [`/api/events/${EVENT}/stream`, "GET"],
    ["/api/auth/get-session", "GET"],
    ["/api/uploads/x.png", "GET"],
  ])("%s (%s) -> bypass", (url, method) => {
    expect(decide({ url, method })).toBe("bypass");
  });

  it("sunucu eylemi POST'u -> bypass", () => {
    expect(decide({ url: `/check-in/${EVENT}`, method: "POST", mode: "same-origin", headers: { "next-action": "abc" } })).toBe(
      "bypass",
    );
    expect(decide({ url: `/check-in/${EVENT}`, method: "POST", mode: "navigate" })).toBe("bypass");
  });

  it.each(["PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])("%s -> bypass", (method) => {
    expect(decide({ url: "/_next/static/chunks/a.js", method })).toBe("bypass");
  });

  it("RSC / sunucu eylemi başlıklı GET ve ?_rsc= sorgusu -> bypass", () => {
    expect(decide({ url: `/check-in/${EVENT}`, mode: "navigate", headers: { rsc: "1" } })).toBe("bypass");
    expect(decide({ url: `/check-in/${EVENT}?_rsc=abc`, mode: "navigate" })).toBe("bypass");
    expect(decide({ url: `/check-in/${EVENT}`, mode: "navigate", headers: { "next-action": "x" } })).toBe("bypass");
  });

  it("kişisel veri taşıyan diğer kimlik doğrulamalı sayfalar -> bypass", () => {
    for (const url of ["/", "/events", `/events/${EVENT}`, "/customers", "/reservations", "/users", "/reviews"]) {
      expect(decide({ url, mode: "navigate" })).toBe("bypass");
    }
  });

  it("başka kaynaktan gelen istekler ve sw.js'in kendisi -> bypass", () => {
    expect(routing.decide({ method: "GET", url: "https://cdn.evil.com/_next/static/a.js", origin: ORIGIN })).toBe("bypass");
    expect(decide({ url: "/sw.js" })).toBe("bypass");
    expect(decide({ url: "/sw-routing.js" })).toBe("bypass");
  });

  it("check-in alt yolları ve sahte kimlikler kabuk sayılmaz", () => {
    expect(decide({ url: `/check-in/${EVENT}/extra`, mode: "navigate" })).toBe("bypass");
    expect(decide({ url: "/check-in/not-a-uuid", mode: "navigate" })).toBe("bypass");
  });
});

describe("service worker yönlendirmesi: önbelleğe alınanlar", () => {
  it("statik varlıklar -> cache-first", () => {
    expect(decide({ url: "/_next/static/chunks/abc123.js" })).toBe("cache-first");
    expect(decide({ url: "/_next/static/media/font.woff2" })).toBe("cache-first");
    expect(decide({ url: "/icons/icon-192.png" })).toBe("cache-first");
    expect(decide({ url: "/manifest.webmanifest" })).toBe("cache-first");
  });

  it("yalnızca check-in kabuğu gezinmeleri -> network-first-shell", () => {
    expect(decide({ url: "/check-in", mode: "navigate" })).toBe("network-first-shell");
    expect(decide({ url: `/check-in/${EVENT}`, mode: "navigate" })).toBe("network-first-shell");
    expect(decide({ url: `/check-in/${EVENT}/`, mode: "navigate" })).toBe("network-first-shell");
  });

  it("giriş sayfası gezinmesi kabuk önbelleğini temizletir (çıkış sonrası paylaşılan cihaz)", () => {
    expect(decide({ url: "/login", mode: "navigate" })).toBe("purge-shell");
  });

  it("ısıtma yalnızca aynı kaynaktaki statik varlıklar ve check-in kabuğu için geçerli", () => {
    expect(routing.isWarmable(`${ORIGIN}/_next/static/chunks/a.js`, ORIGIN)).toBe(true);
    expect(routing.isWarmable(`${ORIGIN}/check-in`, ORIGIN)).toBe(true);
    expect(routing.isWarmable(`${ORIGIN}/api/check-in`, ORIGIN)).toBe(false);
    expect(routing.isWarmable("https://x.test/_next/static/a.js", ORIGIN)).toBe(false);
    expect(routing.isWarmable(`${ORIGIN}/customers`, ORIGIN)).toBe(false);
  });
});
