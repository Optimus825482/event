import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { loginAttempts, rateLimits } from "@/db/schema";
import { auth } from "@/features/auth/auth";
import { ALL_IPS_KEY } from "@/features/auth/login-attempts";
import { createAdmin } from "../../../scripts/create-admin-dev";
import { truncateAll } from "../../helpers/db";
import { nextIp, PASSWORD, signIn, WRONG_PASSWORD } from "./helpers";

const IP_A = "198.51.100.10";
const IP_B = "198.51.100.20";
/** Her yanlış parola bir bcrypt (maliyet 12) doğrulamasıdır; çok denemeli testler için. */
const SLOW_TEST_MS = 60_000;

/**
 * Sabit IP'den giriş. Better Auth'un IP hız sınırı (10 sn'de 3) yalnızca giriş
 * kilidi ölçülsün diye her denemeden önce sıfırlanır.
 */
async function signInFrom(username: string, password: string, ip: string): Promise<Response> {
  await db.delete(rateLimits);
  return signIn(username, password, { ip });
}

async function failTimes(username: string, times: number, ip: string = IP_A): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await signInFrom(username, WRONG_PASSWORD, ip)).status);
  }
  return statuses;
}

async function attemptsFor(username: string, ip: string): Promise<number | undefined> {
  const [row] = await db
    .select({ attempts: loginAttempts.attempts })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.username, username), eq(loginAttempts.ip, ip)));
  return row?.attempts;
}

describe("giriş kilidi: kullanıcı adı + IP başına", () => {
  beforeEach(async () => {
    await truncateAll();
    await createAdmin({ username: "alice", password: PASSWORD });
  });

  it("aynı IP'den 6. deneme doğru parolayla da 429; başka IP'den doğru parola başarılı", async () => {
    expect(await failTimes("alice", 5, IP_A)).toEqual([401, 401, 401, 401, 401]);

    expect((await signInFrom("alice", PASSWORD, IP_A)).status).toBe(429);
    expect((await signInFrom("alice", PASSWORD, IP_B)).status).toBe(200);
  });

  it("başka bir kullanıcı adı aynı IP'den etkilenmez", async () => {
    await createAdmin({ username: "diger", password: PASSWORD });
    await failTimes("alice", 6, IP_A);

    expect((await signInFrom("diger", WRONG_PASSWORD, IP_A)).status).toBe(401);
    expect((await signInFrom("diger", PASSWORD, IP_A)).status).toBe(200);
  });

  it("var olmayan kullanıcı adı da aynı biçimde sayılır", async () => {
    expect(await failTimes("olmayan_kullanici", 6, IP_A)).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it("pencere geçince deneme yeniden mümkün olur", async () => {
    await failTimes("alice", 6, IP_A);
    await db
      .update(loginAttempts)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(loginAttempts.username, "alice"));

    expect((await signInFrom("alice", PASSWORD, IP_A)).status).toBe(200);
  });

  it("başarılı giriş yalnızca o IP'nin sayacını siler; genel sayaç önceki hataları korur", async () => {
    await failTimes("alice", 4, IP_A);
    await failTimes("alice", 2, IP_B);
    expect((await signInFrom("alice", PASSWORD, IP_A)).status).toBe(200);

    expect(await attemptsFor("alice", IP_A)).toBeUndefined();
    expect(await attemptsFor("alice", IP_B)).toBe(2);
    expect(await attemptsFor("alice", ALL_IPS_KEY)).toBe(7);
    expect(await failTimes("alice", 5, IP_A)).toEqual([401, 401, 401, 401, 401]);
  });

  it("süresi dolmuş satırlar fırsat buldukça silinir", async () => {
    await db.insert(loginAttempts).values({
      username: "eski_deneme",
      ip: IP_A,
      attempts: 3,
      expiresAt: sql`now() - interval '1 minute'`,
    });

    await signInFrom("alice", WRONG_PASSWORD, IP_A);

    const stale = await db.select().from(loginAttempts).where(eq(loginAttempts.username, "eski_deneme"));
    expect(stale).toHaveLength(0);
  });
});

describe("giriş kilidi: kullanıcı adı başına genel sınır", () => {
  beforeEach(async () => {
    await truncateAll();
    await createAdmin({ username: "alice", password: PASSWORD });
  });

  it("30 farklı IP'den 30 hatadan sonra yeni bir IP'den deneme 429 döner", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      statuses.push((await signIn("alice", WRONG_PASSWORD, { ip: nextIp() })).status);
    }
    expect(statuses.every((s) => s === 401)).toBe(true);

    expect((await signIn("alice", PASSWORD, { ip: nextIp() })).status).toBe(429);
  }, SLOW_TEST_MS);

  it("kilitli tek bir IP'nin denemeleri genel sayacı büyütmez", async () => {
    await failTimes("alice", 40, IP_A);

    expect(await attemptsFor("alice", ALL_IPS_KEY)).toBe(5);
    expect((await signInFrom("alice", PASSWORD, IP_B)).status).toBe(200);
  }, SLOW_TEST_MS);
});

describe("giriş kilidi: güvenilir IP başlığı yokken", () => {
  beforeEach(async () => {
    await truncateAll();
    await createAdmin({ username: "alice", password: PASSWORD });
  });

  it("x-forwarded-for ne olursa olsun 6. deneme 429 döner", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      // IP tabanlı hız sınırını devre dışı bırak; yalnızca giriş kilidi ölçülsün.
      await db.delete(rateLimits);
      const res = await signIn("alice", i === 5 ? PASSWORD : WRONG_PASSWORD, {
        instance: auth,
        ip: `203.0.113.${i + 1}`,
      });
      statuses.push(res.status);
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });
});

describe("IP tabanlı hız sınırı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("TRUSTED_IP_HEADER tanımsızken x-forwarded-for değiştirmek IP sınırını sıfırlamaz", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      // Giriş kilidine takılmamak için her denemede farklı kullanıcı adı.
      const res = await signIn(`kullanici_${i}`, WRONG_PASSWORD, { instance: auth, ip: `203.0.113.${i + 1}` });
      statuses.push(res.status);
    }

    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it("sayaçlar bellekte değil veritabanında tutulur", async () => {
    await signIn("yonetici", WRONG_PASSWORD);

    const rows = await db.select({ key: rateLimits.key }).from(rateLimits);
    expect(rows.some((r) => r.key.endsWith("|/sign-in/username"))).toBe(true);
  });
});
