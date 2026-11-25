import type { Department, DepartmentLevel } from "./departments";
import type { PolicyActor } from "./policy";
import type { Role } from "./roles";

/** Sistem Yöneticisi mi? */
export function isAdmin(actor: { role: Role }): boolean {
  return actor.role === "admin";
}

/** Aktör verilen departmana (isteğe bağlı olarak verilen düzeylerden birinde) üye mi? */
export function inDepartment(
  actor: Pick<PolicyActor, "memberships">,
  department: Department,
  levels?: readonly DepartmentLevel[],
): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.department === department && (levels === undefined || levels.includes(membership.level)),
  );
}

/**
 * Değerlendirmelerde yalnızca kendi ekibini görebilen aktör: F&B'de yönetici/asistan olmayan `user`
 * (F&B üyeliği hiç olmayan `user` da dahil). Admin her ekibi görür.
 */
export function ownTeamOnly(actor: PolicyActor): boolean {
  if (isAdmin(actor)) return false;
  return !inDepartment(actor, "fnb", ["manager", "assistant"]);
}
