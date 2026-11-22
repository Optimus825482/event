import { and, count, eq, ne, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { accounts, sessions, userPermissions, users } from "@/db/schema";
import { auth, hashPassword } from "@/features/auth/auth";
import { deactivateUser, reactivateUser } from "@/features/auth/admin";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type {
  CreateUserInput,
  ResetPasswordInput,
  SetPermissionsInput,
  SetUserActiveInput,
  UpdateUserInput,
} from "./schemas";
import { USER_COLUMNS, type UserSummary } from "./types";

const PLACEHOLDER_EMAIL_DOMAIN = "eventflow.invalid";

const MESSAGES = {
  notFound: "Kullanıcı bulunamadı",
  usernameTaken: "Bu kullanıcı adı zaten kayıtlı",
  emailTaken: "Bu e-posta adresi zaten kayıtlı",
  selfDeactivate: "Kendi hesabınızı pasifleştiremezsiniz",
  lastAdminDeactivate: "Sistemdeki son aktif yönetici pasifleştirilemez",
  lastAdminDemote: "Sistemdeki son aktif yöneticinin rolü değiştirilemez",
} as const;

/** Yönetici sayısını etkileyen işlemleri (pasifleştirme, rol düşürme) sıraya sokar. */
async function withAdminLock<T>(db: Db | Tx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('eventflow_admin_guard'))`);
    return fn(tx);
  });
}

async function otherActiveAdmins(tx: Tx, excludeId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, excludeId)));
  return row?.n ?? 0;
}

async function getTarget(tx: Db | Tx, id: string) {
  const [row] = await tx
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, id));
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

async function readSummary(db: Db | Tx, id: string): Promise<UserSummary> {
  const [row] = await db.select(USER_COLUMNS).from(users).where(eq(users.id, id));
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

async function assertUnique(db: Db | Tx, username: string | undefined, email: string | undefined, selfId?: string) {
  const clauses = [
    username !== undefined ? eq(users.username, username) : undefined,
    email !== undefined ? eq(users.email, email) : undefined,
  ].filter((c) => c !== undefined);
  if (clauses.length === 0) return;
  const match = or(...clauses);
  const rows = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(selfId ? and(match, ne(users.id, selfId)) : match);
  if (rows.some((r) => r.username === username)) throw new DomainError("conflict", MESSAGES.usernameTaken);
  if (rows.length > 0) throw new DomainError("conflict", MESSAGES.emailTaken);
}

/** Kullanıcı + parola hesabı oluşturur (Better Auth iç bağdaştırıcısı; bcrypt aynı maliyetle). */
export async function createUser(db: Db | Tx, actor: Actor, input: CreateUserInput): Promise<UserSummary> {
  authorize(actor, "users", "create");
  const email = (input.email || `${input.username}@${PLACEHOLDER_EMAIL_DOMAIN}`).toLowerCase();
  await assertUnique(db, input.username, email);

  const ctx = await auth.$context;
  const passwordHash = await hashPassword(input.password);
  const user = await ctx.internalAdapter.createUser(
    {
      name: input.name || input.username,
      email,
      emailVerified: true,
      username: input.username,
      role: input.role,
      isActive: true,
      ...(input.staffId ? { staffId: input.staffId } : {}),
    },
    { method: "admin" },
  );
  try {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    });
  } catch (error) {
    // Parolasız (giriş yapamayan) yetim kullanıcı bırakma.
    await ctx.internalAdapter.deleteUser(user.id);
    throw error;
  }
  return readSummary(db, user.id);
}

/** Profil ve rol günceller. Son aktif adminin rolü düşürülemez. */
export async function updateUser(db: Db | Tx, actor: Actor, input: UpdateUserInput): Promise<UserSummary> {
  authorize(actor, "users", "edit");
  const { id, email, ...rest } = input;
  const values: Partial<typeof users.$inferInsert> = { ...rest };
  if (email !== undefined) values.email = email.toLowerCase();

  return withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, id);
    const demoting = input.role !== undefined && input.role !== "admin" && target.role === "admin";
    if (demoting && target.isActive && (await otherActiveAdmins(tx, id)) === 0) {
      throw new DomainError("conflict", MESSAGES.lastAdminDemote);
    }
    await assertUnique(tx, undefined, values.email, id);

    const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    if (Object.keys(defined).length > 0) await tx.update(users).set(defined).where(eq(users.id, id));
    return readSummary(tx, id);
  });
}

/**
 * Kullanıcıyı etkinleştirir/pasifleştirir (`deactivateUser`/`reactivateUser`). Pasifleştirme
 * oturumları siler; kendini ve son aktif yöneticiyi pasifleştirmek reddedilir.
 */
export async function setUserActive(db: Db | Tx, actor: Actor, input: SetUserActiveInput): Promise<UserSummary> {
  authorize(actor, "users", "edit");
  await withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, input.id);
    if (!input.active) {
      if (target.id === actor.id) throw new DomainError("conflict", MESSAGES.selfDeactivate);
      if (target.role === "admin" && target.isActive && (await otherActiveAdmins(tx, target.id)) === 0) {
        throw new DomainError("conflict", MESSAGES.lastAdminDeactivate);
      }
      await deactivateUser(target.id);
    } else {
      await reactivateUser(target.id);
    }
  });
  return readSummary(db, input.id);
}

/** Yönetici parola sıfırlar: yeni hash yazılır ve kullanıcının tüm oturumları aynı işlemde silinir. */
export async function resetUserPassword(
  db: Db | Tx,
  actor: Actor,
  input: ResetPasswordInput,
): Promise<{ id: string }> {
  authorize(actor, "users", "edit");
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await getTarget(tx, input.id);
    const updated = await tx
      .update(accounts)
      .set({ password: passwordHash })
      .where(and(eq(accounts.userId, input.id), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (updated.length === 0) {
      await tx
        .insert(accounts)
        .values({ userId: input.id, accountId: input.id, providerId: "credential", password: passwordHash });
    }
    await tx.delete(sessions).where(eq(sessions.userId, input.id));
  });
  return { id: input.id };
}

/** Kullanıcının modül izin satırlarını verilen listeyle değiştirir (boş liste = hepsini kaldır). */
export async function setUserPermissions(
  db: Db | Tx,
  actor: Actor,
  input: SetPermissionsInput,
): Promise<{ id: string; count: number }> {
  authorize(actor, "users", "edit");
  await db.transaction(async (tx) => {
    await getTarget(tx, input.id);
    await tx.delete(userPermissions).where(eq(userPermissions.userId, input.id));
    if (input.permissions.length > 0) {
      await tx.insert(userPermissions).values(input.permissions.map((p) => ({ ...p, userId: input.id })));
    }
  });
  return { id: input.id, count: input.permissions.length };
}
