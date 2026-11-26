import { asc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { departmentMemberships, staff, userPermissions, users } from "@/db/schema";
import { authorize, type PermissionRow } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import type { Membership } from "@/features/auth/departments";
import { USER_COLUMNS, type UserSummary, type UserWithMemberships } from "./types";

export type UserDetail = UserWithMemberships & { permissions: PermissionRow[] };

const MEMBERSHIP_COLUMNS = {
  userId: departmentMemberships.userId,
  department: departmentMemberships.department,
  level: departmentMemberships.level,
} as const;

const PERMISSION_COLUMNS = {
  userId: userPermissions.userId,
  module: userPermissions.module,
  canView: userPermissions.canView,
  canCreate: userPermissions.canCreate,
  canEdit: userPermissions.canEdit,
  canDelete: userPermissions.canDelete,
} as const;

/** Liste satırı: üyelikler ve izin satırları düzenleme formunu ek sorgu olmadan doldurur. */
export async function listUsers(db: Db | Tx, actor: Actor): Promise<UserDetail[]> {
  authorize(actor, "users", "view");
  const list: UserSummary[] = await db.select(USER_COLUMNS).from(users).orderBy(asc(users.username));
  const rows = await db.select(MEMBERSHIP_COLUMNS).from(departmentMemberships);
  const byUser = new Map<string, Membership[]>();
  for (const { userId, ...membership } of rows) {
    byUser.set(userId, [...(byUser.get(userId) ?? []), membership]);
  }
  const grants = await db.select(PERMISSION_COLUMNS).from(userPermissions).orderBy(asc(userPermissions.module));
  const grantsByUser = new Map<string, PermissionRow[]>();
  for (const { userId, ...grant } of grants) {
    grantsByUser.set(userId, [...(grantsByUser.get(userId) ?? []), grant]);
  }
  return list.map((user) => ({
    ...user,
    memberships: byUser.get(user.id) ?? [],
    permissions: grantsByUser.get(user.id) ?? [],
  }));
}

export async function getUserDetail(db: Db | Tx, actor: Actor, id: string): Promise<UserDetail | null> {
  authorize(actor, "users", "view");
  const [user] = await db.select(USER_COLUMNS).from(users).where(eq(users.id, id));
  if (!user) return null;
  const permissions = await db
    .select({
      module: userPermissions.module,
      canView: userPermissions.canView,
      canCreate: userPermissions.canCreate,
      canEdit: userPermissions.canEdit,
      canDelete: userPermissions.canDelete,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, id))
    .orderBy(asc(userPermissions.module));
  const memberships: Membership[] = await db
    .select({ department: departmentMemberships.department, level: departmentMemberships.level })
    .from(departmentMemberships)
    .where(eq(departmentMemberships.userId, id))
    .orderBy(asc(departmentMemberships.department));
  return { ...user, memberships, permissions };
}

export type LinkableStaff = {
  id: string;
  fullName: string;
  sicilNo: string;
  status: "active" | "inactive" | "terminated";
  /** Kayıt zaten bir hesaba bağlıysa o hesap; seçicide kapalı gösterilir (kendi hesabı hariç). */
  linkedUserId: string | null;
  linkedUserName: string | null;
};

/**
 * Kullanıcı formundaki "Personel kaydı" seçicisinin listesi. Yetki `users:view` ile denetlenir
 * (kullanıcı yönetimi yalnızca yöneticidir); personel modülü görüntüleme yetkisi aranmaz, çünkü
 * hesap bağlamak o modülü açmayı gerektirmez ve yalnızca ad, sicil no ve durum döner.
 * Ayrılmış personel listelenmez, ancak bir hesaba hâlâ bağlıysa gösterilir.
 */
export async function listLinkableStaff(db: Db | Tx, actor: Actor): Promise<LinkableStaff[]> {
  authorize(actor, "users", "view");
  const rows = await db
    .select({
      id: staff.id,
      fullName: staff.fullName,
      sicilNo: staff.sicilNo,
      status: staff.status,
      linkedUserId: users.id,
      linkedUserName: users.name,
    })
    .from(staff)
    .leftJoin(users, eq(users.staffId, staff.id))
    .orderBy(asc(staff.fullName), asc(staff.sicilNo));
  return rows.filter((r) => r.status !== "terminated" || r.linkedUserId !== null);
}
