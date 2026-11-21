import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { loginAttempts, rateLimits } from "@/db/schema";
import { auth } from "@/features/auth/auth";
import { createAdmin } from "../../../scripts/create-admin";
import { truncateAll } from "../../helpers/db";
import { PASSWORD, signIn, WRONG_PASSWORD } from "./helpers";

async function failTimes(username: string, times: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await signIn(username, WRONG_PASSWORD)).status);
  }
  return statuses;
}

describe("kullanıcı adı başına giriş kilidi", () => {
  beforeEach(async () => {
    await truncateAll();
    await createAdmin({ username: "yonetici", password: PASSWORD });
  });

  it("farklı IP'lerden gelse de 6. başarısız deneme 429 döner", async () => {
    const statuses = await failTimes("yonetici", 6);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it("kilit süresince doğru parola da 429 alır", async () => {
    await failTimes("yonetici", 5);

    expect((await signIn("yonetici", PASSWORD)).status).toBe(429);
  });

  it("başka bir kullanıcı adı etkilenmez", async () => {
    await createAdmin({ username: "diger", password: PASSWORD });
    await failTimes("yonetici", 6);

    expect((await signIn("diger", WRONG_PASSWORD)).status).toBe(401);
    expect((await signIn("diger", PASSWORD)).status).toBe(200);
  });

  it("var olmayan kullanıcı adı da aynı biçimde sayılır", async () => {
    const statuses = await failTimes("olmayan_kullanici", 6);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it("pencere geçince deneme yeniden mümkün olur", async () => {
    await failTimes("yonetici", 6);
    await db
      .update(loginAttempts)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(loginAttempts.username, "yonetici"));

    expect((await signIn("yonetici", PASSWORD)).status).toBe(200);
  });

  it("başarılı giriş sayacı sıfırlar", async () => {
    await failTimes("yonetici", 4);
    expect((await signIn("yonetici", PASSWORD)).status).toBe(200);

    expect(await failTimes("yonetici", 5)).toEqual([401, 401, 401, 401, 401]);
  });

  it("süresi dolmuş satırlar fırsat buldukça silinir", async () => {
    await db.insert(loginAttempts).values({
      username: "eski_deneme",
      attempts: 3,
      expiresAt: sql`now() - interval '1 minute'`,
    });

    await signIn("yonetici", WRONG_PASSWORD);

    const stale = await db.select().from(loginAttempts).where(eq(loginAttempts.username, "eski_deneme"));
    expect(stale).toHaveLength(0);
  });
});

describe("IP tabanlı hız sınırı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("TRUSTED_IP_HEADER tanımsızken x-forwarded-for değiştirmek IP sınırını sıfırlamaz", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      // Kullanıcı adı başına kilide takılmamak için her denemede farklı kullanıcı adı.
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
