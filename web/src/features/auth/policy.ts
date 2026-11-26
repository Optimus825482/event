import { ceilingOf, type Membership } from "./departments";
import { ForbiddenError } from "./errors";
import type { Role } from "./roles";
import { ownTeamOnly } from "./scope";

export const MODULES = [
  "users",
  "settings",
  "events",
  "venues",
  "staff",
  "customers",
  "invitations",
  "reservations",
  "check_in",
  "reviews",
  "notifications",
] as const;
export const VERBS = ["view", "create", "edit", "delete"] as const;

export type Module = (typeof MODULES)[number];
export type Verb = (typeof VERBS)[number];

export type PermissionRow = {
  module: Module;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type PolicyActor = {
  id: string;
  role: Role;
  staffId: string | null;
  memberships: readonly Membership[];
  permissions: readonly PermissionRow[];
};

/**
 * `reviews` kaynağı: `reviewerStaffIds` personeli değerlendirebilecek kişilerin personel kimlikleridir
 * (bkz. features/reviews/authority.ts). Tanınmayan alan yetki vermez (kapalı başarısız olur).
 */
export type PolicyResource = { reviewerStaffIds?: readonly string[] };

const ROW_FLAG = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
} as const;

// Yalnızca yönetici yetkisi; hiçbir departman tavanında yer almaz.
const ADMIN_ONLY_MODULES: readonly Module[] = ["users", "settings"];

/**
 * `user` rolü için karar: üyeliklerden en az biri izin vermeli. Tavan fiili içermeli; yönetici
 * tavanın tamamını, asistan `delete` dışını alır, kullanıcı ise izin satırında açılmış bayrağı.
 * İzin satırı verilen yetkidir (kısıt değil) ve tavanı aşamaz. Üyeliksiz kullanıcı hiçbir şeye erişemez.
 */
function departmentAllows(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): boolean {
  if (ADMIN_ONLY_MODULES.includes(module)) return false;
  const granted = actor.permissions.some((row) => row.module === module && row[ROW_FLAG[verb]]);
  const allowed = actor.memberships.some(({ department, level }) => {
    if (!ceilingOf(department, module).includes(verb)) return false;
    if (level === "manager") return true;
    if (level === "assistant") return verb !== "delete";
    return granted;
  });
  if (!allowed) return false;
  if (module === "reviews" && ownTeamOnly(actor)) {
    const staffId = actor.staffId;
    return staffId !== null && resource?.reviewerStaffIds?.includes(staffId) === true;
  }
  return true;
}

export function can(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): boolean {
  if (actor.role === "admin") return true;
  return departmentAllows(actor, module, verb, resource);
}

export function authorize(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): void {
  if (!can(actor, module, verb, resource)) throw new ForbiddenError();
}
