import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it("çerezsiz korumalı yolu /login?next= adresine yönlendirir", () => {
    const res = proxy(request("/events?tab=a"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/events?tab=a");
  });

  it("kök yolu da korur", () => {
    const res = proxy(request("/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").searchParams.get("next")).toBe("/");
  });

  it.each(["better-auth.session_token=abc", "__Secure-better-auth.session_token=abc"])(
    "oturum çerezi (%s) varsa geçirir",
    (cookie) => {
      const res = proxy(request("/events", cookie));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("ilgisiz çerez oturum sayılmaz", () => {
    expect(proxy(request("/events", "other=1")).status).toBe(307);
  });

  it.each(["/login", "/api/auth/sign-in/username", "/api/health", "/i/abc123"])(
    "%s çerezsiz erişilebilir",
    (path) => {
      const res = proxy(request(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it.each(["/api/sales/v1/events", "/masam", "/masam/abc"])("%s çerezsiz erişilebilir", (path) => {
    const res = proxy(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/masamx korunur", () => expect(proxy(request("/masamx")).status).toBe(307));

  it("/login ile başlayan ama farklı yollar korunur", () => {
    expect(proxy(request("/loginx")).status).toBe(307);
  });
  describe("API yolları", () => {
    it.each(["/api/events/123/stream", "/api/uploads/logo.png", "/api/events/1/stream?x=1"])(
      "%s çerezsiz 401 JSON döner, yönlendirmez",
      async (path) => {
        const res = proxy(request(path));
        expect(res.status).toBe(401);
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(res.headers.get("content-type")).toContain("application/json");
        expect(await res.json()).toEqual({ message: "Oturum gerekli" });
      },
    );

    it("oturum çerezi varsa API isteği geçer", () => {
      const res = proxy(request("/api/events/123/stream", "better-auth.session_token=abc"));
      expect(res.status).toBe(200);
    });

    it("sayfa yolu hâlâ next= ile yönlendirir (API'ye benzeyen /apix dahil)", () => {
      for (const path of ["/events/1", "/apix/foo"]) {
        const res = proxy(request(path));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").searchParams.get("next")).toBe(path);
      }
    });

    it.each(["/api/auth/get-session", "/api/auth/sign-out", "/api/health"])("%s çerezsiz geçer", (path) => {
      const res = proxy(request(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBeNull();
    });
  });

  describe("CSP ve nonce", () => {
    function nonceOf(csp: string | null): string {
      return /'nonce-([^']+)'/.exec(csp ?? "")?.[1] ?? "";
    }

    it.each([
      ["/login", undefined],
      ["/i/abc123", undefined],
      ["/events", "better-auth.session_token=abc"],
    ])("%s yanıtı nonce'lu CSP taşır ve nonce istek başlığıyla aynıdır", (path, cookie) => {
      const res = proxy(request(path, cookie));
      const csp = res.headers.get("content-security-policy");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("'strict-dynamic'");
      const nonce = nonceOf(csp);
      expect(nonce.length).toBeGreaterThanOrEqual(22);
      // Next, nonce'u İSTEK başlıklarından okur: proxy bunları geçirmelidir.
      expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
      expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    });

    it("her istekte farklı nonce üretir", () => {
      const a = nonceOf(proxy(request("/login")).headers.get("content-security-policy"));
      const b = nonceOf(proxy(request("/login")).headers.get("content-security-policy"));
      expect(a).not.toBe(b);
    });
  });

  describe("PWA dosyaları", () => {
    // Next, matcher dizgesini yol için tam eşleşen bir düzenli ifade olarak değerlendirir.
    const matcher = new RegExp("^" + config.matcher[0] + "$");

    it.each(["/sw.js", "/sw-routing.js", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/icons/icon.svg"])(
      "%s proxy tarafından hiç işlenmez (oturumsuz erişilebilir)",
      (path) => {
        expect(matcher.test(path)).toBe(false);
      },
    );

    it.each(["/check-in", "/api/check-in", "/events", "/"])("%s proxy tarafından işlenir (korumalı kalır)", (path) => {
      expect(matcher.test(path)).toBe(true);
    });
  });
});
