import type { Department, DepartmentLevel } from "./departments";
import type { PolicyActor } from "./policy";
import type { Role } from "./roles";

/** Sistem Yöneticisi mi? */
export function isAdmin(actor: { role: Role }): boolean {
  return actor.role === "admin";
}

/** Aktör verilen departmana (isteğe bağlı olarak verilen düzeylerden birinde) üye mi? */
export function inDepartment(
  actor: PolicyActor,
  department: Department,
  levels?: readonly DepartmentLevel[],
): boolean {
  return (actor.memberships ?? []).some(
    (membership) =>
      membership.department === department && (levels === undefined || levels.includes(membership.level)),
  );
}

/**
 * Değerlendirmelerde yalnızca kendi ekibini görebilen aktör: eski `leader` rolü ya da
 * F&B'de yönetici/asistan olmayan `user` (F&B üyeliği hiç olmayan `user` da dahil).
 */
export function ownTeamOnly(actor: PolicyActor): boolean {
  if (actor.role === "leader") return true;
  if (actor.role !== "user") return false;
  return !inDepartment(actor, "fnb", ["manager", "assistant"]);
}

/** Yalnızca kendi etkinliklerini gören aktör (eski `organizer` rolü; Task 10'da silinir). */
export function seesOnlyOwnEvents(actor: { role: Role }): boolean {
  return actor.role === "organizer";
}
