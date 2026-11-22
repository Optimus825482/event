import { and, eq, ne } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { accounts, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/features/auth/auth";
import { clearLoginAttempts, registerLoginAttempt } from "@/features/auth/login-attempts";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { ChangeOwnPasswordInput } from "./schemas";

const MESSAGES = {
  notFound: "Hesap bulunamadı",
  wrongCurrent: "Mevcut parola hatalı",
  tooMany: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.",
  sameAsCurrent: "Yeni parola mevcut parolayla aynı olamaz",
} as const;

/**
 * Giriş kilidiyle aynı sayaç tablosu; kullanıcı adı alanında bu önekli kullanıcı kimliği tutulur.
 * Baştaki boşluk bilerek vardır: `isValidUsername` baş/son boşluklu adları reddettiği için giriş ucu
 * bu anahtarı hiçbir zaman üretemez (oturumsuz biri bu sayacı doldurup parola değişimini kilitleyemez).
 */
export function limiterKey(actorId: string): string {
  return ` pwchange:${actorId}`;
}

/**
 * Oturumdaki kullanıcının kendi parolasını değiştirir. Yetki: yalnızca kendi satırı (`actor.id`) ve
 * aktif hesap. Mevcut parola kimlik bilgisi hesabına karşı doğrulanır; yanlışsa ayrıntı sızdırmayan
 * tek bir hata döner. Denemeler giriş kilidindeki sayaçla sınırlanır (15 dk'da 5), başarıda sayaç silinir.
 * Başarıda `keepSessionId` dışındaki tüm oturumlar kapanır; kimliği bilinmiyorsa hepsi kapanır.
 * Şema zaten doğrular; servis kuralları yineler (doğrudan çağrılara karşı ikinci savunma).
 */
export async function changeOwnPassword(
  db: Db | Tx,
  actor: Actor,
  input: ChangeOwnPasswordInput,
  keepSessionId: string | null = null,
): Promise<{ otherSessionsRevoked: true }> {
  const [user] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, actor.id));
  if (!user?.isActive) throw new DomainError("not_found", MESSAGES.notFound);
  if (input.newPassword === input.currentPassword) throw new DomainError("invalid", MESSAGES.sameAsCurrent);

  const [account] = await db
    .select({ id: accounts.id, password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, actor.id), eq(accounts.providerId, "credential")));

  if (await registerLoginAttempt(limiterKey(actor.id), null)) throw new DomainError("invalid", MESSAGES.tooMany);
  const valid =
    account?.password != null && (await verifyPassword({ hash: account.password, password: input.currentPassword }));
  if (!account || !valid) throw new DomainError("invalid", MESSAGES.wrongCurrent);

  const passwordHash = await hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ password: passwordHash }).where(eq(accounts.id, account.id));
    await tx
      .delete(sessions)
      .where(
        keepSessionId === null
          ? eq(sessions.userId, actor.id)
          : and(eq(sessions.userId, actor.id), ne(sessions.id, keepSessionId)),
      );
  });
  await clearLoginAttempts(limiterKey(actor.id), null);
  return { otherSessionsRevoked: true };
}
