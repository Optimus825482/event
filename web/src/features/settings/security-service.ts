import { and, desc, eq, gt, ne, not, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { loginAttempts, sessions, users } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { ALL_IPS_KEY, MAX_ATTEMPTS_ALL_IPS, MAX_ATTEMPTS_PER_IP } from "@/features/auth/login-attempts";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { ClearLockoutInput, RevokeSessionInput } from "./security-schemas";

const MAX_USER_AGENT = 300;
/** Parola değiştirme sınırlayıcısının anahtar öneki (own-password.ts); giriş kilidi değildir. */
const PASSWORD_CHANGE_PREFIX = " pwchange:";

const MESSAGES = {
  ownSession: "Kendi oturumunuzu buradan kapatamazsınız; çıkış yapın",
  unknownCurrent: "Geçerli oturum belirlenemedi",
  sessionNotFound: "Oturum bulunamadı",
  lockoutNotFound: "Kilit bulunamadı",
} as const;

export type SessionRow = {
  id: string;
  userId: string;
  userName: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export type LockoutRow = {
  username: string;
  ip: string;
  /** `all`: kullanıcı adının tüm IP'lerdeki toplam sayacı; `ip`: tek IP'ye özel. */
  scope: "ip" | "all";
  attempts: number;
  expiresAt: Date;
};

/** Güvenlik sekmesi yalnızca yöneticinindir: ayar izni verilmiş başka rol de erişemez. */
function requireAdmin(actor: Actor, verb: "view" | "edit"): void {
  authorize(actor, "settings", verb);
  if (actor.role !== "admin") throw new ForbiddenError();
}

/** Oturum belirteci (`token`) bilerek seçilmez; istemciye yalnızca kimlik ve üst veri çıkar. */
export async function listActiveSessions(
  db: Db | Tx,
  actor: Actor,
  currentSessionId: string | null,
): Promise<SessionRow[]> {
  requireAdmin(actor, "view");
  const rows = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      userName: users.name,
      username: users.username,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(gt(sessions.expiresAt, sql`now()`))
    .orderBy(desc(sessions.createdAt));
  return rows.map((r) => ({
    ...r,
    userAgent: r.userAgent === null ? null : r.userAgent.slice(0, MAX_USER_AGENT),
    isCurrent: r.id === currentSessionId,
  }));
}

/** Tek bir oturumu kapatır. Yöneticinin kendi geçerli oturumu bu yoldan kapatılamaz. */
export async function revokeSession(
  db: Db | Tx,
  actor: Actor,
  input: RevokeSessionInput,
  currentSessionId: string | null,
): Promise<{ revoked: true }> {
  requireAdmin(actor, "edit");
  if (input.sessionId === currentSessionId) throw new DomainError("invalid", MESSAGES.ownSession);
  const deleted = await db.delete(sessions).where(eq(sessions.id, input.sessionId)).returning({ id: sessions.id });
  if (deleted.length === 0) throw new DomainError("not_found", MESSAGES.sessionNotFound);
  return { revoked: true };
}

/** Geçerli oturum dışındaki tüm oturumları kapatır; geçerli oturum bilinmiyorsa hiçbiri kapatılmaz. */
export async function revokeOtherSessions(
  db: Db | Tx,
  actor: Actor,
  currentSessionId: string | null,
): Promise<{ revokedCount: number }> {
  requireAdmin(actor, "edit");
  if (currentSessionId === null) throw new DomainError("invalid", MESSAGES.unknownCurrent);
  const deleted = await db.delete(sessions).where(ne(sessions.id, currentSessionId)).returning({ id: sessions.id });
  return { revokedCount: deleted.length };
}

/** Giriş denemesi sınırını aşmış ve süresi dolmamış sayaç satırı (`registerLoginAttempt` ile aynı eşik). */
const lockedCondition = and(
  gt(loginAttempts.expiresAt, sql`now()`),
  not(sql`${loginAttempts.username} like ${`${PASSWORD_CHANGE_PREFIX}%`}`),
  or(
    and(ne(loginAttempts.ip, ALL_IPS_KEY), gt(loginAttempts.attempts, MAX_ATTEMPTS_PER_IP)),
    and(eq(loginAttempts.ip, ALL_IPS_KEY), gt(loginAttempts.attempts, MAX_ATTEMPTS_ALL_IPS)),
  ),
);

export async function listLockouts(db: Db | Tx, actor: Actor): Promise<LockoutRow[]> {
  requireAdmin(actor, "view");
  const rows = await db
    .select()
    .from(loginAttempts)
    .where(lockedCondition)
    .orderBy(desc(loginAttempts.expiresAt), loginAttempts.username);
  return rows.map((r) => ({ ...r, scope: r.ip === ALL_IPS_KEY ? "all" : "ip" }));
}

/** Etkin bir kilidi kaldırır (satırı siler); satır kilitli değilse ya da yoksa `not_found`. */
export async function clearLockout(db: Db | Tx, actor: Actor, input: ClearLockoutInput): Promise<{ cleared: true }> {
  requireAdmin(actor, "edit");
  const deleted = await db
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.username, input.username), eq(loginAttempts.ip, input.ip), lockedCondition))
    .returning({ username: loginAttempts.username });
  if (deleted.length === 0) throw new DomainError("not_found", MESSAGES.lockoutNotFound);
  return { cleared: true };
}
