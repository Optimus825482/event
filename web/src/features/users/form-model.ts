import { ADMIN_LABEL } from "@/components/layout/role-labels";
import {
  DEPARTMENT_LABELS,
  grantableCeiling,
  LEVEL_LABELS,
  type Membership,
} from "@/features/auth/departments";
import type { Module, PermissionRow, Verb } from "@/features/auth/policy";
import type { Role } from "@/features/auth/roles";
import { PERMISSION_MODULES } from "./schemas";

export const MODULE_LABELS: Record<(typeof PERMISSION_MODULES)[number], string> = {
  events: "Etkinlikler",
  reservations: "Rezervasyonlar",
  check_in: "Check-in",
  staff: "Personel",
  customers: "Müşteriler",
  venues: "Mekânlar",
  invitations: "Davetiyeler",
  notifications: "Bildirimler",
  reviews: "Değerlendirmeler",
  ticketing: "Bilet ve Satış",
  finance: "Finans",
  archive: "Arşiv ve Raporlar",
};

/** Fiil sırası ve `PermissionRow` bayrakları. */
export const VERB_FLAGS = [
  ["view", "canView", "Görüntüle"],
  ["create", "canCreate", "Oluştur"],
  ["edit", "canEdit", "Düzenle"],
  ["delete", "canDelete", "Sil"],
] as const satisfies readonly (readonly [Verb, keyof Omit<PermissionRow, "module">, string])[];

export type GridRow = { module: Module; label: string; verbs: Verb[] };

/** İzin tablosu satırları: yalnızca `Kullanıcı` düzeyindeki üyeliklerin tavanındaki modüller ve fiiller. */
export function permissionGrid(memberships: readonly Membership[]): GridRow[] {
  const ceiling = grantableCeiling(memberships);
  return PERMISSION_MODULES.flatMap((module) => {
    const verbs = ceiling[module];
    return verbs && verbs.length > 0 ? [{ module, label: MODULE_LABELS[module], verbs: [...verbs] }] : [];
  });
}

/** Üyelik değişince tavan dışında kalan fiilleri kapatır; hiçbir fiili kalmayan satırı atar. */
export function pruneGrants(grants: readonly PermissionRow[], memberships: readonly Membership[]): PermissionRow[] {
  const ceiling = grantableCeiling(memberships);
  const pruned: PermissionRow[] = [];
  for (const grant of grants) {
    const allowed = ceiling[grant.module] ?? [];
    const row: PermissionRow = {
      module: grant.module,
      canView: grant.canView && allowed.includes("view"),
      canCreate: grant.canCreate && allowed.includes("create"),
      canEdit: grant.canEdit && allowed.includes("edit"),
      canDelete: grant.canDelete && allowed.includes("delete"),
    };
    if (row.canView || row.canCreate || row.canEdit || row.canDelete) pruned.push(row);
  }
  return pruned;
}

/** Liste sütunu: "Sistem Yöneticisi" ya da "Departman · Düzey, …". */
export function accessSummary(role: Role, memberships: readonly Membership[]): string {
  if (role === "admin") return ADMIN_LABEL;
  if (memberships.length > 0) {
    return memberships.map((m) => `${DEPARTMENT_LABELS[m.department]} · ${LEVEL_LABELS[m.level]}`).join(", ");
  }
  return "Departman atanmamış";
}

/** Rol seçimi: yeni model yalnızca iki seçenek sunar. */
export const ROLE_CHOICES = [
  { value: "admin", label: ADMIN_LABEL },
  { value: "user", label: "Departman kullanıcısı" },
] as const;

/** Rolün departman ve izin alanları var mı? (Sistem yöneticisi için gizlenir.) */
export function usesDepartments(role: Role): boolean {
  return role === "user";
}
