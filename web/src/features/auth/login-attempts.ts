import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

/**
 * Giriş kilidi (PostgreSQL'de, 15 dakikalık pencere), iki sayaçla:
 * - (kullanıcı adı, istemci IP'si) başına 5 deneme: aşılınca o ad yalnızca o IP'den kilitlenir.
 * - Kullanıcı adı başına, tüm IP'ler için 30 deneme: dağıtık tahmine karşı yedek kilit.
 * Kilitli bir IP'nin denemeleri genel sayacı büyütmez; böylece tek bir IP gerçek
 * kullanıcıyı her yerden kilitleyemez. Başarılı giriş yalnızca o IP'nin sayacını
 * siler. Var olan ve olmayan kullanıcı adları aynı biçimde sayılır.
 */
export const MAX_ATTEMPTS_PER_IP = 5;
export const MAX_ATTEMPTS_ALL_IPS = 30;
export const LOGIN_WINDOW_MINUTES = 15;

/** IP çözülemediğinde kullanılan tek ortak anahtar (çift sınırı kullanıcı adı başına sınıra düşer). */
export const UNKNOWN_IP_KEY = "unknown";
/** Kullanıcı adının tüm IP'lerdeki toplamını tutan satırın anahtarı (geçerli bir IP olamaz). */
export const ALL_IPS_KEY = "*";

const windowEnd = sql`now() + make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;

async function increment(username: string, ip: string): Promise<number> {
  const expired = sql`${loginAttempts.expiresAt} <= now()`;
  const [row] = await db
    .insert(loginAttempts)
    .values({ username, ip, attempts: 1, expiresAt: windowEnd })
    .onConflictDoUpdate({
      target: [loginAttempts.username, loginAttempts.ip],
      set: {
        attempts: sql`case when ${expired} then 1 else ${loginAttempts.attempts} + 1 end`,
        expiresAt: sql`case when ${expired} then ${windowEnd} else ${loginAttempts.expiresAt} end`,
      },
    })
    .returning({ attempts: loginAttempts.attempts });
  return row?.attempts ?? 1;
}

/**
 * Denemeyi kaydeder; deneme kilit sınırlarından birini aşıyorsa `true` döner.
 * `ip` null ise deneme `UNKNOWN_IP_KEY` altında sayılır.
 */
export async function registerLoginAttempt(username: string, ip: string | null): Promise<boolean> {
  // Süresi dolmuş satırları fırsat buldukça temizle (tablo sınırlı kalsın).
  await db.delete(loginAttempts).where(lte(loginAttempts.expiresAt, sql`now()`));

  if ((await increment(username, ip ?? UNKNOWN_IP_KEY)) > MAX_ATTEMPTS_PER_IP) return true;
  return (await increment(username, ALL_IPS_KEY)) > MAX_ATTEMPTS_ALL_IPS;
}

/** Yalnızca (kullanıcı adı, IP) sayacını siler; genel sayaç korunur. */
export async function clearLoginAttempts(username: string, ip: string | null): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.username, username), eq(loginAttempts.ip, ip ?? UNKNOWN_IP_KEY)));
}
