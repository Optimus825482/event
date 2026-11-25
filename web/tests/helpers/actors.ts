import { randomUUID } from "node:crypto";
import { departmentMemberships, userPermissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Department, DepartmentLevel } from "@/features/auth/departments";
import type { Module, PermissionRow } from "@/features/auth/policy";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { createUser as createLoginUser } from "@/features/users/service";
import type { UserSummary } from "@/features/users/types";
import { createMembership, createUser, type Executor } from "./factories";

type Grants = Partial<Record<Module, string>>;

/** "vce-" gibi gösterimi izin satırına çevirir (v=görüntüle c=oluştur e=düzenle d=sil, "-" = yok). */
function rowsFrom(grants: Grants): PermissionRow[] {
  return (Object.entries(grants) as [Module, string][]).map(([module, flags]) => ({
    module,
    canView: flags.includes("v"),
    canCreate: flags.includes("c"),
    canEdit: flags.includes("e"),
    canDelete: flags.includes("d"),
  }));
}

function build(
  role: Actor["role"],
  memberships: Actor["memberships"],
  permissions: PermissionRow[],
  o: Partial<Actor>,
): Actor {
  const id = o.id ?? randomUUID();
  return {
    id,
    username: `t_${id.slice(0, 8)}`,
    role,
    staffId: null,
    memberships,
    permissions,
    ...o,
  };
}

export function adminActor(o: Partial<Actor> = {}): Actor {
  return build("admin", [], [], o);
}

function leveled(level: DepartmentLevel, department: Department, grants: Grants, o: Partial<Actor>): Actor {
  return build("user", [{ department, level }], rowsFrom(grants), o);
}

export function managerActor(department: Department, o: Partial<Actor> = {}): Actor {
  return leveled("manager", department, {}, o);
}

export function assistantActor(department: Department, o: Partial<Actor> = {}): Actor {
  return leveled("assistant", department, {}, o);
}

/** Kullanıcı düzeyi: yalnızca `grants` ile açılan yetkiler (tavanı aşamaz). */
export function memberActor(department: Department, grants: Grants, o: Partial<Actor> = {}): Actor {
  return leveled("member", department, grants, o);
}

/** `user` rolü, üyeliksiz: hiçbir modüle erişemez. */
export function noAccessActor(o: Partial<Actor> = {}): Actor {
  return build("user", [], [], o);
}

/** Var olan kullanıcıya aktörün üyeliklerini ve izin satırlarını yazar. */
export async function grantActor(ex: Executor, userId: string, actor: Actor): Promise<void> {
  for (const { department, level } of actor.memberships) {
    await createMembership(ex, { userId, department, level });
  }
  if (actor.permissions.length > 0) {
    await ex.insert(userPermissions).values(actor.permissions.map((p) => ({ ...p, userId })));
  }
}

/** Aktörü veritabanına yazar (kullanıcı + üyelikler + izin satırları); gerçek `id` ile döner. */
export async function persistActor(ex: Executor, actor: Actor): Promise<Actor> {
  const user = await createUser(ex, {
    role: actor.role,
    ...(actor.staffId ? { staffId: actor.staffId } : {}),
  });
  await grantActor(ex, user.id, actor);
  return { ...actor, id: user.id, username: user.username };
}

/**
 * Eski rolle (`organizer`, `venue_owner`, `leader`...) aktör üretir; sahiplik ve bildirim hedef rolü
 * testleri için. Task 10'da eski roller kalkınca bu yardımcı ve çağrıları silinir.
 */
export async function legacyActor(ex: Executor, role: Actor["role"], o: Partial<Actor> = {}): Promise<Actor> {
  const user = await createUser(ex, { role, ...(o.staffId ? { staffId: o.staffId } : {}) });
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    staffId: user.staffId,
    memberships: [],
    permissions: [],
  };
}

/**
 * Servis üzerinden parolalı hesap açar. `admin` ve `user` yeni yoldan (user: F&B kullanıcısı);
 * eski roller önce `user` olarak açılıp role çevrilir ve üyelikleri silinir. Task 10'da eski roller
 * kalkınca eski rol dalı silinir.
 */
export async function createLoginAccount(
  db: Parameters<typeof createLoginUser>[0],
  admin: Actor,
  role: Role,
  input: { username: string; password: string; email?: string; name?: string },
): Promise<UserSummary> {
  const memberships = role === "admin" ? [] : [{ department: "fnb" as const, level: "member" as const }];
  const created = await createLoginUser(db, admin, {
    ...input,
    role: role === "admin" ? "admin" : "user",
    memberships,
    permissions: [],
  });
  if (role === "admin" || role === "user") return created;
  await db.delete(departmentMemberships).where(eq(departmentMemberships.userId, created.id));
  await db.update(users).set({ role }).where(eq(users.id, created.id));
  return { ...created, role };
}
