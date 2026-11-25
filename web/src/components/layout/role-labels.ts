import { DEPARTMENT_LABELS, LEVEL_LABELS } from "@/features/auth/departments";
import type { PolicyActor } from "@/features/auth/policy";
import { isAdmin } from "@/features/auth/scope";

/** `admin` rolünün arayüz adı. */
export const ADMIN_LABEL = "Sistem Yöneticisi";

/**
 * Profil menüsündeki kısa erişim etiketi: "Sistem Yöneticisi", "Casino · Yönetici",
 * çoklu üyelikte "Food & Beverage +1", üyeliksizde "Kullanıcı".
 */
export function actorLabel(actor: PolicyActor): string {
  if (isAdmin(actor)) return ADMIN_LABEL;
  const [first, ...rest] = actor.memberships;
  if (!first) return "Kullanıcı";
  if (rest.length === 0) return `${DEPARTMENT_LABELS[first.department]} · ${LEVEL_LABELS[first.level]}`;
  return `${DEPARTMENT_LABELS[first.department]} +${rest.length}`;
}
