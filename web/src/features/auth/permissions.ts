import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { userPermissions } from "@/db/schema";
import { requireActor, type Actor } from "./session";
import type { PermissionRow } from "./policy";

/** Kullanıcıya özel izin satırlarını okur (`can`/`authorize` bunları baseline'a ekler). */
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

export type ActorWithPermissions = Actor & { permissions: PermissionRow[] };

export async function withPermissions(actor: Actor): Promise<ActorWithPermissions> {
  return { ...actor, permissions: await loadPermissions(actor.id) };
}

/**
 * Sayfa ve düzenler için: oturumdaki kullanıcı + izin satırları. İstek başına bir kez
 * çözülür (`cache`), böylece düzen ve sayfa aynı sorguyu tekrarlamaz.
 * Oturum yoksa `UnauthenticatedError` fırlatır.
 */
export const requirePolicyActor = cache(async (): Promise<ActorWithPermissions> => {
  return withPermissions(await requireActor());
});
