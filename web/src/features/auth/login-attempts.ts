import { eq, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

/**
 * Kullanıcı adı başına giriş kilidi (IP'den bağımsız, PostgreSQL'de).
 * Her deneme sayılır; başarılı giriş sayacı siler. Böylece sayaç fiilen
 * ardışık başarısız denemeleri gösterir. Var olan ve olmayan kullanıcı adları
 * aynı biçimde sayılır.
 */
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_WINDOW_MINUTES = 15;

const windowEnd = sql`now() + make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;

/** Denemeyi kaydeder ve penceredeki toplam deneme sayısını döndürür. */
export async function registerLoginAttempt(username: string): Promise<number> {
  // Süresi dolmuş satırları fırsat buldukça temizle (tablo sınırlı kalsın).
  await db.delete(loginAttempts).where(lte(loginAttempts.expiresAt, sql`now()`));

  const expired = sql`${loginAttempts.expiresAt} <= now()`;
  const [row] = await db
    .insert(loginAttempts)
    .values({ username, attempts: 1, expiresAt: windowEnd })
    .onConflictDoUpdate({
      target: loginAttempts.username,
      set: {
        attempts: sql`case when ${expired} then 1 else ${loginAttempts.attempts} + 1 end`,
        expiresAt: sql`case when ${expired} then ${windowEnd} else ${loginAttempts.expiresAt} end`,
      },
    })
    .returning({ attempts: loginAttempts.attempts });
  return row?.attempts ?? 1;
}

export function isLockedOut(attempts: number): boolean {
  return attempts > MAX_FAILED_LOGINS;
}

export async function clearLoginAttempts(username: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
}
