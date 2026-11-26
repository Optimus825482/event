import { describe, expect, it } from "vitest";
import { createTtlCache } from "@/lib/cache";

describe("TTL önbelleği", () => {
  it("eşzamanlı 100 çağrı tek yükleme yapar", async () => {
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 10 });
    const load = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 5));
      return 42;
    };
    const results = await Promise.all(Array.from({ length: 100 }, () => cache.get("k", load)));
    expect(results).toEqual(Array(100).fill(42));
    expect(loads).toBe(1);
  });

  it("süre dolunca yeniden yükler", async () => {
    let now = 0;
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 10, now: () => now });
    const load = async () => ++loads;
    expect(await cache.get("k", load)).toBe(1);
    now = 999;
    expect(await cache.get("k", load)).toBe(1);
    now = 1001;
    expect(await cache.get("k", load)).toBe(2);
    expect(loads).toBe(2);
  });

  it("reddedilen yükleme önbelleğe alınmaz", async () => {
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 10 });
    await expect(
      cache.get("k", async () => {
        loads++;
        throw new Error("patladı");
      }),
    ).rejects.toThrow("patladı");
    expect(
      await cache.get("k", async () => {
        loads++;
        return 7;
      }),
    ).toBe(7);
    expect(loads).toBe(2);
  });

  it("girdi sınırı aşılınca en eski atılır", async () => {
    const loads: Record<string, number> = {};
    const cache = createTtlCache<string>({ ttlMs: 1000, maxEntries: 2 });
    const loader = (key: string) => async () => {
      loads[key] = (loads[key] ?? 0) + 1;
      return key;
    };
    await cache.get("a", loader("a"));
    await cache.get("b", loader("b"));
    await cache.get("c", loader("c"));
    await cache.get("c", loader("c"));
    expect(loads.c).toBe(1);
    await cache.get("a", loader("a"));
    expect(loads.a).toBe(2);
  });

  it("clear tüm girdileri siler", async () => {
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 10 });
    await cache.get("k", async () => ++loads);
    cache.clear();
    await cache.get("k", async () => ++loads);
    expect(loads).toBe(2);
  });
});
