import { describe, expect, it } from "vitest";
import { createFlightCache } from "@/features/sales-api/flight-cache";

describe("uçuş önbelleği", () => {
  it("eşzamanlı 50 çağrı tek yükleme paylaşır", async () => {
    const cache = createFlightCache<number>({ ttlMs: 2000 });
    let loads = 0;
    const load = async () => {
      loads += 1;
      await new Promise((r) => setTimeout(r, 10));
      return 7;
    };
    const results = await Promise.all(Array.from({ length: 50 }, () => cache.get("k", load)));
    expect(loads).toBe(1);
    expect(new Set(results)).toEqual(new Set([7]));
  });

  it("süre dolana dek aynı değer, sonra yeniden yüklenir", async () => {
    let t = 0;
    const cache = createFlightCache<number>({ ttlMs: 2000, now: () => t });
    let n = 0;
    const load = async () => ++n;
    expect(await cache.get("k", load)).toBe(1);
    t = 1999;
    expect(await cache.get("k", load)).toBe(1);
    t = 2000;
    expect(await cache.get("k", load)).toBe(2);
  });

  it("başarısız yükleme önbelleğe alınmaz", async () => {
    const cache = createFlightCache<number>({ ttlMs: 2000 });
    await expect(cache.get("k", () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(await cache.get("k", async () => 5)).toBe(5);
  });

  it("anahtarlar bağımsızdır; sınır aşılınca en eski atılır", async () => {
    const cache = createFlightCache<string>({ ttlMs: 2000, maxKeys: 2 });
    const calls: string[] = [];
    const loader = (v: string) => async () => {
      calls.push(v);
      return v;
    };
    expect(await cache.get("a", loader("a"))).toBe("a");
    expect(await cache.get("b", loader("b"))).toBe("b");
    await cache.get("a", loader("a2"));
    expect(calls).toEqual(["a", "b"]);
    await cache.get("c", loader("c"));
    await cache.get("a", loader("a3"));
    expect(calls).toEqual(["a", "b", "c", "a3"]);
    await cache.get("c", loader("c2"));
    expect(calls).toEqual(["a", "b", "c", "a3"]);
  });
});
