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
  memberships?: readonly Membership[];
  permissions?: readonly PermissionRow[];
};

export type PolicyResource = { ownerId?: string; teamLeaderStaffId?: string };

type Grants = Partial<Record<Module, readonly Verb[]>>;

const ALL_VERBS: readonly Verb[] = VERBS;

const ORGANIZER_MODULES: readonly Module[] = [
  "events",
  "venues",
  "staff",
  "customers",
  "invitations",
  "reservations",
  "check_in",
  "reviews",
  "notifications",
];

// Baseline matrix: anything not listed is denied. Ownership is applied
// separately (see OWNED) for the roles that need it.
const BASELINE: Record<Role, Grants> = {
  admin: Object.fromEntries(MODULES.map((m) => [m, ALL_VERBS])),
  organizer: Object.fromEntries(ORGANIZER_MODULES.map((m) => [m, ALL_VERBS])),
  staff: {
    reservations: ["view", "create", "edit"],
    customers: ["view"],
    check_in: ["view", "create"],
  },
  leader: {
    check_in: ["view", "create"],
    reviews: ["view", "create", "edit"],
    notifications: ["view"],
  },
  controller: { check_in: ["view", "create"] },
  venue_owner: { venues: ["view", "create", "edit", "delete"] },
  // `user` rolü BASELINE'a bakılmadan departman dalında (departmentAllows) karar verilir.
  user: {},
};

const ROW_FLAG = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
} as const;

function ownershipAllows(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): boolean {
  if (actor.role === "leader" && module === "reviews") {
    return (
      actor.staffId !== null &&
      resource?.teamLeaderStaffId !== undefined &&
      resource.teamLeaderStaffId === actor.staffId
    );
  }
  if (actor.role === "venue_owner" && module === "venues") {
    if (resource === undefined) return verb === "view" || verb === "create";
    return resource.ownerId === actor.id;
  }
  return true;
}

// Yalnızca yönetici yetkisi; hiçbir departman tavanında yer almaz.
const ADMIN_ONLY_MODULES: readonly Module[] = ["users", "settings"];

/**
 * `user` rolü için karar: üyeliklerden en az biri izin vermeli. Tavan fiili içermeli; yönetici
 * tavanın tamamını, asistan `delete` dışını alır, kullanıcı ise izin satırında açılmış bayrağı.
 * İzin satırı burada verilen yetkidir (kısıt değil) ve tavanı aşamaz.
 */
function departmentAllows(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): boolean {
  if (ADMIN_ONLY_MODULES.includes(module)) return false;
  const granted = (actor.permissions ?? []).some((row) => row.module === module && row[ROW_FLAG[verb]]);
  const allowed = (actor.memberships ?? []).some(({ department, level }) => {
    if (!ceilingOf(department, module).includes(verb)) return false;
    if (level === "manager") return true;
    if (level === "assistant") return verb !== "delete";
    return granted;
  });
  if (!allowed) return false;
  if (module === "reviews" && ownTeamOnly(actor)) {
    return actor.staffId !== null && resource?.teamLeaderStaffId === actor.staffId;
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
  if (actor.role === "user") return departmentAllows(actor, module, verb, resource);
  if (!BASELINE[actor.role][module]?.includes(verb)) return false;
  if (!ownershipAllows(actor, module, verb, resource)) return false;
  return (actor.permissions ?? [])
    .filter((row) => row.module === module)
    .every((row) => row[ROW_FLAG[verb]]);
}

export function authorize(
  actor: PolicyActor,
  module: Module,
  verb: Verb,
  resource?: PolicyResource,
): void {
  if (!can(actor, module, verb, resource)) throw new ForbiddenError();
}
