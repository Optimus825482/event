import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

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
});
