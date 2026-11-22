import { asc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { userPermissions, users } from "@/db/schema";
import { authorize, type PermissionRow } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { USER_COLUMNS, type UserSummary } from "./types";

export type UserDetail = UserSummary & { permissions: PermissionRow[] };

export async function listUsers(db: Db | Tx, actor: Actor): Promise<UserSummary[]> {
  authorize(actor, "users", "view");
  return db.select(USER_COLUMNS).from(users).orderBy(asc(users.username));
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
  return { ...user, permissions };
}
