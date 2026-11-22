import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("sınıra kadar izin verir, sonrasında Retry-After ile reddeder", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: c.now });
    for (let i = 0; i < 3; i += 1) expect(limiter.check("a")).toEqual({ allowed: true });
    c.advance(10_000);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it("anahtarlar birbirinden bağımsızdır", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("pencere kayar: eski istekler düşünce yeniden izin verilir ve reddedilenler pencereyi uzatmaz", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: c.now });
    limiter.check("a");
    c.advance(600);
    limiter.check("a");
    c.advance(100);
    expect(limiter.check("a").allowed).toBe(false);
    c.advance(350); // ilk istek (t=0) 1050 ms önce kaldı
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("bellek sınırlıdır: anahtar sayısı maxKeys'i aşmaz", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 1000; i += 1) limiter.check(`ip-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(100);
  });

  it("süresi dolan anahtarlar yer açmak için önce silinir", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000, maxKeys: 2, now: c.now });
    limiter.check("a");
    limiter.check("b");
    c.advance(2000);
    limiter.check("c");
    expect(limiter.size()).toBe(1);
  });
});
