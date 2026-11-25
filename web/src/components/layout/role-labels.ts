import { DEPARTMENT_LABELS, LEVEL_LABELS } from "@/features/auth/departments";
import type { PolicyActor } from "@/features/auth/policy";
import type { Role } from "@/features/auth/roles";

/** Eski roller (Task 10'da kalkar) ve yönetici etiketi; kullanıcı yönetimi ekranları kullanır. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Sistem Yöneticisi",
  organizer: "Organizatör",
  staff: "Personel",
  leader: "Ekip lideri",
  controller: "Kontrolör",
  venue_owner: "Mekân sahibi",
  user: "Kullanıcı",
};

/**
 * Profil menüsündeki kısa erişim etiketi: "Sistem Yöneticisi", "Casino · Yönetici",
 * çoklu üyelikte "Food & Beverage +1", üyeliksizde "Kullanıcı".
 */
export function actorLabel(actor: PolicyActor): string {
  if (actor.role !== "user") return ROLE_LABELS[actor.role];
  const [first, ...rest] = actor.memberships ?? [];
  if (!first) return ROLE_LABELS.user;
  if (rest.length === 0) return `${DEPARTMENT_LABELS[first.department]} · ${LEVEL_LABELS[first.level]}`;
  return `${DEPARTMENT_LABELS[first.department]} +${rest.length}`;
}
