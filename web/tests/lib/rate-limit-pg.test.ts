import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { publicRateLimits } from "@/db/schema";
import { createPgRateLimiter } from "@/lib/rate-limit";
import { truncateAll } from "../helpers/db";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function limiter(overrides: Partial<Parameters<typeof createPgRateLimiter>[0]> = {}) {
  return createPgRateLimiter({
    db,
    scope: "test",
    limit: 3,
    windowMs: 60_000,
    pruneProbability: 0,
    onError: () => undefined,
    ...overrides,
  });
}

describe("createPgRateLimiter", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sınıra kadar izin verir, sonra Retry-After ile reddeder; anahtarlar ve kapsamlar bağımsızdır", async () => {
    const a = limiter();
    for (let i = 0; i < 3; i += 1) expect(await a.check("ip-1")).toEqual({ allowed: true });
    const denied = await a.check("ip-1");
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
    expect((await a.check("ip-2")).allowed).toBe(true);
    expect((await limiter({ scope: "baska" }).check("ip-1")).allowed).toBe(true);
  });

  it("iki sınırlayıcı örneği (iki web kopyası) aynı sayacı paylaşır", async () => {
    const replicaA = limiter();
    const replicaB = limiter();
    expect((await replicaA.check("k")).allowed).toBe(true);
    expect((await replicaB.check("k")).allowed).toBe(true);
    expect((await replicaA.check("k")).allowed).toBe(true);
    expect((await replicaB.check("k")).allowed).toBe(false);
  });

  it("eşzamanlı isteklerde atomiktir: tam olarak `limit` kadarı geçer", async () => {
    const a = limiter({ limit: 10 });
    const results = await Promise.all(Array.from({ length: 60 }, () => a.check("yaris")));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    const [row] = await db.select().from(publicRateLimits);
    expect(row?.hits).toBe(60);
  });

  it("pencere dolunca sayaç yeni pencerede sıfırdan başlar", async () => {
    const a = limiter({ limit: 1, windowMs: 1000 });
    // Pencere sınırına yakın başlamamak için bir sonraki saniye başlangıcını bekle.
    await sleep(1000 - (Date.now() % 1000) + 20);
    expect((await a.check("p")).allowed).toBe(true);
    const denied = await a.check("p");
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 1 });
    await sleep(1050);
    expect((await a.check("p")).allowed).toBe(true);
  });

  it("prune yalnızca saklama süresinden eski pencereleri siler", async () => {
    const a = limiter({ retainMs: 600_000 });
    await a.check("taze");
    await db.execute(sql`
      insert into public_rate_limits (scope, key, window_start, hits)
      values ('test', 'eski', now() - interval '2 hours', 5), ('test', 'yakin', now() - interval '2 minutes', 5)
    `);
    expect(await a.prune()).toBe(1);
    const keys = (await db.select().from(publicRateLimits)).map((r) => r.key).sort();
    expect(keys).toEqual(["taze", "yakin"]);
  });

  it("istekler sırasında fırsat buldukça eski satırları kendiliğinden siler", async () => {
    await db.execute(sql`
      insert into public_rate_limits (scope, key, window_start, hits) values ('test', 'eski', now() - interval '3 hours', 1)
    `);
    const a = limiter({ pruneProbability: 1, random: () => 0 });
    await a.check("x");
    await vi.waitFor(async () => {
      const keys = (await db.select().from(publicRateLimits)).map((r) => r.key);
      expect(keys).toEqual(["x"]);
    });
  });

  it("veritabanı hatasında fail-open: isteği geçirir ve hatayı bildirir", async () => {
    const onError = vi.fn();
    const failing = createPgRateLimiter({
      db: { execute: () => Promise.reject(new Error("bağlantı koptu")) } as unknown as typeof db,
      scope: "test",
      limit: 1,
      windowMs: 60_000,
      onError,
    });
    expect(await failing.check("k")).toEqual({ allowed: true });
    expect(await failing.check("k")).toEqual({ allowed: true });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("kapalı kipte veritabanı hatasında isteği reddeder ve hatayı bildirir", async () => {
    const onError = vi.fn();
    const closed = limiter({
      onFailure: "closed",
      onError,
      db: { execute: () => Promise.reject(new Error("bağlantı koptu")) } as unknown as typeof db,
    });
    expect(await closed.check("ip-1")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("kapalı kip sağlıklı veritabanında açık kiple aynı sayar", async () => {
    const closed = limiter({ onFailure: "closed" });
    for (let i = 0; i < 3; i += 1) expect(await closed.check("ip-1")).toEqual({ allowed: true });
    expect((await closed.check("ip-1")).allowed).toBe(false);
  });

  it("refund geçerli penceredeki sayımı geri alır, sıfırın altına inmez ve hatayı yutar", async () => {
    const a = limiter();
    await a.refund("ip-1");
    for (let i = 0; i < 10; i += 1) {
      expect(await a.check("ip-1")).toEqual({ allowed: true });
      await a.refund("ip-1");
    }
    for (let i = 0; i < 3; i += 1) expect((await a.check("ip-1")).allowed).toBe(true);
    expect((await a.check("ip-1")).allowed).toBe(false);
    const onError = vi.fn();
    const broken = limiter({ db: { execute: async () => { throw new Error("x"); } } as never, onError });
    await expect(broken.refund("ip-1")).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalled();
  });
});
