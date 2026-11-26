import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { findTableByCode } from "@/features/find-table/lookup";
import {
  createFindTableLimiters,
  FIND_TABLE_CODE_LIMIT,
  FIND_TABLE_IP_LIMIT,
  FindTableRateLimitedError,
  type FindTableLimiters,
} from "@/features/find-table/rate-limit";
import { truncateAll } from "../../helpers/db";
import { ticketedEvent } from "../../helpers/door";
import { rejection } from "../check-in/fixtures";

const allowAll = { check: async () => ({ allowed: true as const }) };
const ctx = { ip: "203.0.113.7" };
const exploding = new Proxy({}, {
  get() {
    throw new Error("veritabanına dokunuldu");
  },
}) as never;

describe("masamı bul hız sınırı", () => {
  beforeEach(async () => {
    await truncateAll();
    await db.execute(sql`delete from public_rate_limits`);
  });

  it("sabitler sözleşmedeki gibidir", () => {
    expect(FIND_TABLE_IP_LIMIT).toEqual({ limit: 5, windowMs: 600_000 });
    expect(FIND_TABLE_CODE_LIMIT).toEqual({ limit: 10, windowMs: 3_600_000 });
  });

  it("aynı IP'den 5 denemeden sonra 6. deneme DOĞRU bilgiyle bile sınırlanır (gerçek sayaç)", async () => {
    const te = await ticketedEvent();
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 5; i += 1) {
      expect(await findTableByCode(db, { code: `ZZZZZZZ${(i % 8) + 2}`, lastName: "x" }, ctx, { limiters })).toBeNull();
    }
    const err = await rejection(findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters }));
    expect(err).toBeInstanceOf(FindTableRateLimitedError);
    expect((err as FindTableRateLimitedError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("başarılı aramalar IP sayacına yazılmaz: aynı IP'den 6 başarılı arama da geçer (gerçek sayaç)", async () => {
    const te = await ticketedEvent();
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 6; i += 1) {
      expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters })).not.toBeNull();
    }
  });

  it("5 başarısız denemeden sonraki deneme 429 olur; araya giren başarılı arama sayılmaz", async () => {
    const te = await ticketedEvent();
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 5; i += 1) {
      expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Kaya" }, ctx, { limiters })).toBeNull();
      if (i === 2) expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters })).not.toBeNull();
    }
    expect(await rejection(findTableByCode(db, { code: "ZZZZZZZZ", lastName: "x" }, ctx, { limiters }))).toBeInstanceOf(
      FindTableRateLimitedError,
    );
  });

  it("farklı IP'ler birbirini etkilemez", async () => {
    const te = await ticketedEvent();
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 5; i += 1) await findTableByCode(db, { code: "ZZZZZZZZ", lastName: "x" }, ctx, { limiters });
    const found = await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, { ip: "203.0.113.8" }, { limiters });
    expect(found).not.toBeNull();
  });

  it("biçimsiz kod da IP sayacını artırır", async () => {
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 5; i += 1) expect(await findTableByCode(db, { code: "abc", lastName: "x" }, ctx, { limiters })).toBeNull();
    expect(await rejection(findTableByCode(db, { code: "abc", lastName: "x" }, ctx, { limiters }))).toBeInstanceOf(
      FindTableRateLimitedError,
    );
  });

  it("aynı koda farklı IP'lerden 10 denemeden sonra 11. deneme sınırlanır", async () => {
    const limiters = createFindTableLimiters(db);
    for (let i = 0; i < 10; i += 1) {
      expect(await findTableByCode(db, { code: "ZZZZZZZZ", lastName: "x" }, { ip: `198.51.100.${i + 1}` }, { limiters })).toBeNull();
    }
    const err = await rejection(findTableByCode(db, { code: "ZZZZZZZZ", lastName: "x" }, { ip: "198.51.100.99" }, { limiters }));
    expect(err).toBeInstanceOf(FindTableRateLimitedError);
  });

  it("kod sayacı yalnızca biçimi geçerli kodda işler", async () => {
    const code = { check: vi.fn(async () => ({ allowed: true as const })) };
    const limiters: FindTableLimiters = { ip: allowAll, code };
    await findTableByCode(db, { code: "abc", lastName: "x" }, ctx, { limiters });
    expect(code.check).not.toHaveBeenCalled();
    await findTableByCode(db, { code: "ZZZZZZZZ", lastName: "x" }, ctx, { limiters });
    expect(code.check).toHaveBeenCalledWith("ZZZZZZZZ");
  });

  it("sınır aşıldığında iş tablolarına sorgu gitmez", async () => {
    const limiters: FindTableLimiters = { ip: { check: async () => ({ allowed: false, retryAfterSeconds: 30 }) }, code: allowAll };
    const err = await rejection(findTableByCode(exploding, { code: "ZZZZZZZZ", lastName: "x" }, ctx, { limiters }));
    expect(err).toBeInstanceOf(FindTableRateLimitedError);
  });

  it("sayaç veritabanı hatasında kapalı kalır", async () => {
    const broken = createFindTableLimiters({
      execute: async () => {
        throw new Error("db yok");
      },
    } as never);
    expect((await broken.ip.check("203.0.113.7")).allowed).toBe(false);
    expect((await broken.code.check("ABCD2345")).allowed).toBe(false);
  });

  it("sınırlayıcı beklenmedik biçimde fırlatırsa arama yine reddedilir", async () => {
    const limiters: FindTableLimiters = {
      ip: {
        check: async () => {
          throw new Error("x");
        },
      },
      code: allowAll,
    };
    const err = await rejection(findTableByCode(exploding, { code: "ZZZZZZZZ", lastName: "x" }, ctx, { limiters }));
    expect(err).toBeInstanceOf(FindTableRateLimitedError);
  });
});
