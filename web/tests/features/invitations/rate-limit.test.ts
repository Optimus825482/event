import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/invitations/public", () => ({
  getPublicInvitationImagePath: vi.fn(async () => null),
}));

import { GET } from "@/app/i/[token]/image/route";
import { getPublicInvitationImagePath } from "@/features/invitations/public";
import {
  checkInvitationRate,
  INVITATION_RATE_LIMIT,
  invitationClientKey,
  parseRetryAfter,
  tooManyRequestsResponse,
} from "@/features/invitations/rate-limit";
import { createRateLimiter } from "@/lib/rate-limit";
import { truncateAll } from "../../helpers/db";

// Üretimdeki sayaç PostgreSQL'dedir; burada süreç içi uygulama sahte olarak kullanılır.
const fake = (limit: number) => {
  const inner = createRateLimiter({ limit, windowMs: 60_000 });
  return { check: async (key: string) => inner.check(key) };
};

const headersOf = (init: Record<string, string>) => new Headers(init);

describe("invitationClientKey", () => {
  it("yalnızca güvenilir başlığı okur; istemcinin gönderdiği başka başlığa güvenmez", () => {
    const h = headersOf({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" });
    expect(invitationClientKey(h, "x-real-ip")).toBe("203.0.113.7");
    // Başlık yapılandırılmamışsa istemci başlığı yok sayılır (geliştirme/testte getIP yerel adrese düşer).
    expect(invitationClientKey(h, undefined)).not.toBe("198.51.100.9");
    expect(invitationClientKey(h, undefined)).not.toBe("203.0.113.7");
  });

  it("geçersiz değerli başlık anahtar olarak kullanılmaz", () => {
    expect(invitationClientKey(headersOf({ "x-real-ip": "not-an-ip" }), "x-real-ip")).not.toBe("not-an-ip");
  });
});

describe("checkInvitationRate", () => {
  it("IP başına sayar: bir IP sınırı aşınca reddedilir, başka IP etkilenmez", async () => {
    const limiter = fake(2);
    const deps = { limiter, trustedHeader: "x-real-ip" };
    const a = headersOf({ "x-real-ip": "203.0.113.1" });
    expect((await checkInvitationRate(a, deps)).allowed).toBe(true);
    expect((await checkInvitationRate(a, deps)).allowed).toBe(true);
    const denied = await checkInvitationRate(a, deps);
    expect(denied.allowed).toBe(false);
    expect(denied.allowed === false && denied.retryAfterSeconds).toBeGreaterThan(0);
    expect((await checkInvitationRate(headersOf({ "x-real-ip": "203.0.113.2" }), deps)).allowed).toBe(true);
  });
});

describe("429 yanıtı", () => {
  it("durum 429, Retry-After ve önbelleksiz başlıklar", async () => {
    const res = tooManyRequestsResponse(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toContain("Çok fazla istek");
  });

  it("parseRetryAfter sorgu değerini sınırlar", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter("999999")).toBe(3600);
    expect(parseRetryAfter("abc")).toBe(60);
    expect(parseRetryAfter(null)).toBe(60);
    expect(parseRetryAfter("-5")).toBe(60);
  });
});

describe("GET /i/[token]/image hız sınırı (PostgreSQL sayacı)", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(getPublicInvitationImagePath).mockClear();
  });

  it("sınır aşılınca veritabanına gitmeden 429 + Retry-After döner", async () => {
    const context = { params: Promise.resolve({ token: "t" }) };
    const request = () => new Request("http://localhost/i/t/image?p=a/b.png");

    let last = await GET(request(), context);
    for (let i = 0; i < INVITATION_RATE_LIMIT.limit; i += 1) last = await GET(request(), context);

    expect(last.status).toBe(429);
    expect(Number(last.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(vi.mocked(getPublicInvitationImagePath).mock.calls.length).toBe(INVITATION_RATE_LIMIT.limit);
  });
});
