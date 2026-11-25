import { grantableCeiling, type Membership } from "@/features/auth/departments";
import type { PermissionRow, Verb } from "@/features/auth/policy";
import type { Role } from "@/features/auth/roles";

const FLAGS: readonly [Verb, keyof Omit<PermissionRow, "module">][] = [
  ["view", "canView"],
  ["create", "canCreate"],
  ["edit", "canEdit"],
  ["delete", "canDelete"],
];

export const ACCESS_MESSAGES = {
  adminNoAccess: "Sistem yöneticisine departman ya da izin atanmaz",
  needDepartment: "En az bir departman seçin",
  needView: "Görüntüleme izni olmadan diğer izinler verilemez",
  outOfCeiling: "Bu izin seçilen departmanların kapsamı dışında",
} as const;

/** Hiçbir bayrağı açık olmayan satır kaydedilmez. */
export function isEmptyRow(row: PermissionRow): boolean {
  return FLAGS.every(([, flag]) => !row[flag]);
}

/** Satırın açtığı tüm fiiller, üyeliklerden gelen verilebilir tavanın içinde mi? */
export function withinCeiling(row: PermissionRow, memberships: readonly Membership[]): boolean {
  const allowed = grantableCeiling(memberships)[row.module] ?? [];
  return FLAGS.every(([verb, flag]) => !row[flag] || allowed.includes(verb));
}

/**
 * Kaydedilecek satırlar. Tüm bayrakları kapalı satır yalnızca `user` ve `admin` hedefte atılır;
 * eski rollerde bu satır "modülü kapat" kısıtıdır ve atılması taban erişimi geri getirir.
 */
export function effectiveRows(rows: readonly PermissionRow[], role: Role): PermissionRow[] {
  return role === "admin" || role === "user" ? rows.filter((row) => !isEmptyRow(row)) : [...rows];
}

/** Üyelikler değişince korunabilecek satırlar: tavan içinde, görüntüleme açık, boş değil. */
export function pruneToCeiling(rows: readonly PermissionRow[], memberships: readonly Membership[]): PermissionRow[] {
  return rows.filter((row) => !isEmptyRow(row) && row.canView && withinCeiling(row, memberships));
}

/**
 * Rol, üyelik ve izin satırlarının tutarlılığını denetler: hata mesajı ya da `null`.
 * Eski roller (Task 10'da kalkar) bu denetimin dışındadır.
 */
export function checkAccess(
  role: Role,
  memberships: readonly Membership[],
  permissions: readonly PermissionRow[],
): string | null {
  const rows = effectiveRows(permissions, role);
  if (role === "admin") {
    return memberships.length > 0 || rows.length > 0 ? ACCESS_MESSAGES.adminNoAccess : null;
  }
  if (role !== "user") return null;
  if (memberships.length === 0) return ACCESS_MESSAGES.needDepartment;
  for (const row of rows) {
    if (!row.canView) return ACCESS_MESSAGES.needView;
    if (!withinCeiling(row, memberships)) return ACCESS_MESSAGES.outOfCeiling;
  }
  return null;
}
