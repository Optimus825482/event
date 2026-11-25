import { isAdmin } from "@/features/auth/scope";
import type { UserSummary } from "./types";

export type StatusFilter = "all" | "active" | "inactive";
export type RoleFilter = "all" | UserSummary["role"];

export type UserFilters = { search: string; role: RoleFilter; status: StatusFilter };

/** Arama (kullanıcı adı, ad, e-posta, telefon, görev) ile rol ve durum süzgeçlerini uygular. */
export function filterUsers(users: UserSummary[], filters: UserFilters): UserSummary[] {
  const needle = filters.search.trim().toLocaleLowerCase("tr");
  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.status === "active" && !user.isActive) return false;
    if (filters.status === "inactive" && user.isActive) return false;
    if (needle === "") return true;
    return [user.username, user.name, user.email, user.phone ?? "", user.position ?? ""].some((value) =>
      value.toLocaleLowerCase("tr").includes(needle),
    );
  });
}

export type UserCounts = { total: number; active: number; inactive: number; admins: number };

export function countUsers(users: UserSummary[]): UserCounts {
  const active = users.filter((u) => u.isActive).length;
  return {
    total: users.length,
    active,
    inactive: users.length - active,
    admins: users.filter((u) => isAdmin(u)).length,
  };
}

/** Silinmiş (anonimleştirilmiş) hesapların e-posta soneki; `deleteUser` bu biçimi yazar. */
export const DELETED_EMAIL_SUFFIX = "@silinmis.eventflow.invalid";

/** Başka kayıtlarca anıldığı için satırı tutulan, anonimleştirilmiş hesap. */
export function isDeletedAccount(user: Pick<UserSummary, "email" | "isActive">): boolean {
  return !user.isActive && user.email.endsWith(DELETED_EMAIL_SUFFIX);
}
