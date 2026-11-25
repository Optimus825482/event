import { and, count, eq, ne, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  accounts,
  departmentMemberships,
  events,
  sessions,
  staffPerformanceReviews,
  userPermissions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/features/auth/auth";
import { deactivateUser, reactivateUser } from "@/features/auth/admin";
import { ForbiddenError } from "@/features/auth/errors";
import type { Role } from "@/features/auth/roles";
import type { Membership } from "@/features/auth/departments";
import { authorize, type PermissionRow } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type {
  CreateUserInput,
  DeleteUserInput,
  ResetPasswordInput,
  SetMembershipsInput,
  SetPermissionsInput,
  SetUserActiveInput,
  UpdateUserInput,
} from "./schemas";
import { checkAccess, effectiveRows, pruneToCeiling } from "./access-rules";
import { DELETED_EMAIL_SUFFIX, isDeletedAccount } from "./filter";
import { USER_COLUMNS, type UserSummary } from "./types";
import { isAdmin } from "@/features/auth/scope";

const PLACEHOLDER_EMAIL_DOMAIN = "eventflow.invalid";
const DELETED_USERNAME_PREFIX = "silinmis-";

const MESSAGES = {
  notFound: "Kullanıcı bulunamadı",
  usernameTaken: "Bu kullanıcı adı zaten kayıtlı",
  emailTaken: "Bu e-posta adresi zaten kayıtlı",
  selfDeactivate: "Kendi hesabınızı pasifleştiremezsiniz",
  lastAdmin: "Son sistem yöneticisi kaldırılamaz",
  selfDelete: "Kendi hesabınızı silemezsiniz",
  deletedReactivate: "Silinmiş hesap yeniden etkinleştirilemez",
  deletedImmutable: "Silinmiş hesap değiştirilemez",
  reservedEmail: "Bu e-posta adresi kullanılamaz",
  reservedUsername: "Bu kullanıcı adı kullanılamaz",
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
    .select({ id: users.id, role: users.role, isActive: users.isActive, email: users.email })
    .from(users)
    .where(eq(users.id, id));
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

/** Silinmiş (anonimleştirilmiş) hesabın işaretini taklit eden e-posta ve kullanıcı adı normal hesaplara verilmez. */
function assertNotReserved(username: string | undefined, email: string | undefined) {
  if (email !== undefined && email.toLowerCase().endsWith(DELETED_EMAIL_SUFFIX)) {
    throw new DomainError("invalid", MESSAGES.reservedEmail);
  }
  if (username !== undefined && username.toLowerCase().startsWith(DELETED_USERNAME_PREFIX)) {
    throw new DomainError("invalid", MESSAGES.reservedUsername);
  }
}

function assertNotDeleted(target: { email: string; isActive: boolean }) {
  if (isDeletedAccount(target)) throw new DomainError("conflict", MESSAGES.deletedImmutable);
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

function assertAccess(role: Role, memberships: Membership[], rows: PermissionRow[]) {
  const problem = checkAccess(role, memberships, rows);
  if (problem !== null) throw new DomainError("invalid", problem);
}

async function writeMemberships(tx: Db | Tx, userId: string, memberships: readonly Membership[]) {
  await tx.delete(departmentMemberships).where(eq(departmentMemberships.userId, userId));
  if (memberships.length > 0) {
    await tx.insert(departmentMemberships).values(memberships.map((m) => ({ ...m, userId })));
  }
}

/** İzin satırlarını değiştirir; yazılan satır sayısını döner. */
async function writePermissions(tx: Db | Tx, userId: string, rows: readonly PermissionRow[]): Promise<number> {
  await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
  const kept = effectiveRows(rows);
  if (kept.length > 0) await tx.insert(userPermissions).values(kept.map((p) => ({ ...p, userId })));
  return kept.length;
}

async function readMemberships(tx: Db | Tx, userId: string): Promise<Membership[]> {
  return tx
    .select({ department: departmentMemberships.department, level: departmentMemberships.level })
    .from(departmentMemberships)
    .where(eq(departmentMemberships.userId, userId));
}

async function readPermissions(tx: Db | Tx, userId: string): Promise<PermissionRow[]> {
  return tx
    .select({
      module: userPermissions.module,
      canView: userPermissions.canView,
      canCreate: userPermissions.canCreate,
      canEdit: userPermissions.canEdit,
      canDelete: userPermissions.canDelete,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
}

/**
 * Kullanıcı + parola hesabı + üyelikler + izin satırlarını tek işlemde oluşturur (bcrypt aynı
 * maliyetle; Better Auth kullanıcı adı eklentisi normalleştirme/displayUsername kullanmadığından
 * doğrudan satır yazımı bağdaştırıcıyla aynı sonucu verir). Herhangi bir yazım düşerse işlemin
 * tamamı geri alınır.
 */
export async function createUser(db: Db | Tx, actor: Actor, input: CreateUserInput): Promise<UserSummary> {
  authorize(actor, "users", "create");
  assertAccess(input.role, input.memberships, input.permissions);
  const email = (input.email || `${input.username}@${PLACEHOLDER_EMAIL_DOMAIN}`).toLowerCase();
  assertNotReserved(input.username, email);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    await assertUnique(tx, input.username, email);
    const [user] = await tx
      .insert(users)
      .values({
        name: input.name || input.username,
        email,
        emailVerified: true,
        username: input.username,
        role: input.role,
        isActive: true,
        ...(input.staffId ? { staffId: input.staffId } : {}),
      })
      .returning({ id: users.id });
    if (!user) throw new Error("kullanıcı eklenemedi");
    await tx
      .insert(accounts)
      .values({ userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash });
    await writeMemberships(tx, user.id, input.memberships);
    await writePermissions(tx, user.id, input.permissions);
    return readSummary(tx, user.id);
  });
}

/**
 * Profil, rol, üyelik ve izinleri tek işlemde günceller. Sonuçta rol `user` ise yeni durum
 * (üyelikler + izin satırları) `checkAccess` ile doğrulanır: verilen satırlar tavan dışıysa reddedilir,
 * var olan satırlardan tavan dışında kalanlar silinir. Sonuçta `admin` ise üyelik ve izinler temizlenir.
 * Son aktif adminin rolü düşürülemez.
 */
export async function updateUser(db: Db | Tx, actor: Actor, input: UpdateUserInput): Promise<UserSummary> {
  authorize(actor, "users", "edit");
  const { id, email, memberships, permissions, ...rest } = input;
  const values: Partial<typeof users.$inferInsert> = { ...rest };
  if (email !== undefined) values.email = email.toLowerCase();
  assertNotReserved(undefined, values.email);

  return withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, id);
    assertNotDeleted(target);
    const role = input.role ?? target.role;
    const demoting = role !== "admin" && isAdmin(target);
    if (demoting && target.isActive && (await otherActiveAdmins(tx, id)) === 0) {
      throw new DomainError("conflict", MESSAGES.lastAdmin);
    }
    await assertUnique(tx, undefined, values.email, id);

    // Yazılacak yeni durum: verilmeyen kısım mevcut olandır (user için tavana göre budanır).
    let nextMemberships: Membership[] = [];
    let nextRows: PermissionRow[] = [];
    if (role === "admin") {
      // Sistem yöneticisine departman ya da izin atanmaz: verilirse reddedilir, yoksa eskiler temizlenir.
      assertAccess(role, memberships ?? [], permissions ?? []);
    } else {
      nextMemberships = memberships ?? (await readMemberships(tx, id));
      nextRows = permissions ?? (await readPermissions(tx, id));
      if (permissions === undefined) nextRows = pruneToCeiling(nextRows, nextMemberships);
      assertAccess(role, nextMemberships, nextRows);
    }

    const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    if (Object.keys(defined).length > 0) await tx.update(users).set(defined).where(eq(users.id, id));

    if (role === "admin") {
      await writeMemberships(tx, id, []);
      await writePermissions(tx, id, []);
    } else {
      if (memberships !== undefined) await writeMemberships(tx, id, memberships);
      await writePermissions(tx, id, nextRows);
    }
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
      if (isAdmin(target) && target.isActive && (await otherActiveAdmins(tx, target.id)) === 0) {
        throw new DomainError("conflict", MESSAGES.lastAdmin);
      }
      await deactivateUser(target.id);
    } else {
      if (isDeletedAccount(target)) throw new DomainError("conflict", MESSAGES.deletedReactivate);
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
  await withAdminLock(db, async (tx) => {
    assertNotDeleted(await getTarget(tx, input.id));
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

/**
 * Kullanıcının modül izin satırlarını verilen listeyle değiştirir (boş liste = hepsini kaldır).
 * Satırlar verilen yetkidir ve kullanıcının üyeliklerinden gelen tavanı aşamaz.
 */
export async function setUserPermissions(
  db: Db | Tx,
  actor: Actor,
  input: SetPermissionsInput,
): Promise<{ id: string; count: number }> {
  authorize(actor, "users", "edit");
  let written = 0;
  await withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, input.id);
    assertNotDeleted(target);
    const memberships = await readMemberships(tx, input.id);
    assertAccess(target.role, memberships, input.permissions);
    written = await writePermissions(tx, input.id, input.permissions);
  });
  return { id: input.id, count: written };
}

/**
 * Kullanıcının departman üyeliklerini verilen listeyle değiştirir. Artık tavan dışında kalan izin
 * satırları aynı işlemde silinir; kalanlarla birlikte tutarlılık yeniden denetlenir.
 */
export async function setUserMemberships(
  db: Db | Tx,
  actor: Actor,
  input: SetMembershipsInput,
): Promise<{ id: string; count: number }> {
  authorize(actor, "users", "edit");
  await withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, input.id);
    assertNotDeleted(target);
    const current = await readPermissions(tx, input.id);
    const kept = pruneToCeiling(current, input.memberships);
    assertAccess(target.role, input.memberships, kept);
    await writeMemberships(tx, input.id, input.memberships);
    if (kept.length !== current.length) await writePermissions(tx, input.id, kept);
  });
  return { id: input.id, count: input.memberships.length };
}

export const DELETED_USER_NAME = "Silinmiş kullanıcı";

export type DeleteUserResult = { id: string; mode: "deleted" | "anonymized" };

/** `ON DELETE RESTRICT` ile kullanıcıya bağlı kayıtlar: varsa satır silinemez. */
async function hasRestrictingReferences(tx: Tx, userId: string): Promise<boolean> {
  const [organized] = await tx.select({ n: count() }).from(events).where(eq(events.organizerId, userId));
  if ((organized?.n ?? 0) > 0) return true;
  const [reviewed] = await tx
    .select({ n: count() })
    .from(staffPerformanceReviews)
    .where(eq(staffPerformanceReviews.reviewerId, userId));
  return (reviewed?.n ?? 0) > 0;
}

/**
 * Kullanıcıyı siler (yalnızca yönetici). Kendini ve son yöneticiyi silmek reddedilir.
 * - Hiçbir `restrict` başvurusu yoksa satır kalıcı silinir; oturum, parola hesabı ve izinler
 *   `cascade`, diğer başvurular (`created_by_id` vb.) `set null` olur.
 * - Etkinlik sahibi ya da değerlendiren olarak anılıyorsa satır kalır ama anonimleştirilir:
 *   pasif, kişisel alanlar boş, kullanıcı adı/e-posta yer tutucu, rol `user`, parola hesabı,
 *   izinleri, üyelikleri ve tüm oturumları silinir (giriş yapamaz; geçmiş kayıtlar bozulmaz).
 */
export async function deleteUser(db: Db | Tx, actor: Actor, input: DeleteUserInput): Promise<DeleteUserResult> {
  authorize(actor, "users", "delete");
  // Silme izni yalnızca yönetici rolündedir; özel izin satırları bunu genişletemez.
  if (!isAdmin(actor)) throw new ForbiddenError();
  return withAdminLock(db, async (tx) => {
    const target = await getTarget(tx, input.id);
    if (target.id === actor.id) throw new DomainError("conflict", MESSAGES.selfDelete);
    if (isAdmin(target) && (await otherActiveAdmins(tx, target.id)) === 0) {
      throw new DomainError("conflict", MESSAGES.lastAdmin);
    }

    if (!(await hasRestrictingReferences(tx, target.id))) {
      await tx.delete(users).where(eq(users.id, target.id));
      return { id: target.id, mode: "deleted" };
    }

    await tx
      .update(users)
      .set({
        name: DELETED_USER_NAME,
        username: `${DELETED_USERNAME_PREFIX}${target.id}`,
        email: `${target.id}${DELETED_EMAIL_SUFFIX}`,
        emailVerified: false,
        image: null,
        role: "user",
        isActive: false,
        staffId: null,
        color: null,
        phone: null,
        position: null,
      })
      .where(eq(users.id, target.id));
    await tx.delete(sessions).where(eq(sessions.userId, target.id));
    await tx.delete(accounts).where(eq(accounts.userId, target.id));
    await tx.delete(userPermissions).where(eq(userPermissions.userId, target.id));
    await tx.delete(departmentMemberships).where(eq(departmentMemberships.userId, target.id));
    return { id: target.id, mode: "anonymized" };
  });
}
