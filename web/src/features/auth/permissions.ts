import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { departmentMemberships, userPermissions } from "@/db/schema";
import type { Membership } from "./departments";
import type { PermissionRow } from "./policy";
import { requireActor, type Actor } from "./session";

/** Kullanıcının departman üyeliklerini (departman + düzey) okur. */
export async function loadMemberships(userId: string): Promise<Membership[]> {
  return db
    .select({
      department: departmentMemberships.department,
      level: departmentMemberships.level,
    })
    .from(departmentMemberships)
    .where(eq(departmentMemberships.userId, userId));
}

/** Kullanıcıya özel izin satırlarını okur (`can`/`authorize` bunları değerlendirir). */
export async function loadPermissions(userId: string): Promise<PermissionRow[]> {
  const rows = await db
    .select({
      module: userPermissions.module,
      canView: userPermissions.canView,
      canCreate: userPermissions.canCreate,
      canEdit: userPermissions.canEdit,
      canDelete: userPermissions.canDelete,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return rows;
}

/**
 * Sayfa ve düzenler için: oturumdaki kullanıcı (üyelik + izin satırlarıyla). İstek başına bir kez
 * çözülür (`cache`), böylece düzen ve sayfa aynı sorguyu tekrarlamaz.
 * Oturum yoksa `UnauthenticatedError` fırlatır.
 */
export const requirePolicyActor = cache(async (): Promise<Actor> => requireActor());
