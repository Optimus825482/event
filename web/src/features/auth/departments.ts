import type { Module, Verb } from "./policy";

export const DEPARTMENTS = ["entertainment", "fnb", "casino"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LEVELS = ["manager", "assistant", "member"] as const;
export type DepartmentLevel = (typeof DEPARTMENT_LEVELS)[number];

export type Membership = { department: Department; level: DepartmentLevel };

export const DEPARTMENT_LABELS: Record<Department, string> = {
  entertainment: "Entertainment",
  fnb: "Food & Beverage",
  casino: "Casino",
};

export const LEVEL_LABELS: Record<DepartmentLevel, string> = {
  manager: "Yönetici",
  assistant: "Yönetici Asistanı",
  member: "Kullanıcı",
};

type Ceiling = Partial<Record<Module, readonly Verb[]>>;

// Fiil sırası her zaman view, create, edit, delete.
const VERB_ORDER: readonly Verb[] = ["view", "create", "edit", "delete"];

// Departman tavan matrisi. Listelenmeyen modül kapalıdır (boş dizi).
// users ve settings hiçbir departmanda yoktur.
const CEILING: Record<Department, Ceiling> = {
  entertainment: {
    events: ["view", "create", "edit", "delete"],
    invitations: ["view", "create", "edit", "delete"],
    notifications: ["view", "create", "edit", "delete"],
    venues: ["view"],
    check_in: ["view", "create"],
    ticketing: ["view", "create", "edit", "delete"],
    finance: ["view", "create", "edit", "delete"],
    archive: ["view", "create", "edit", "delete"],
  },
  fnb: {
    events: ["view"],
    notifications: ["view"],
    venues: ["view", "create", "edit", "delete"],
    staff: ["view", "create", "edit", "delete"],
    reviews: ["view", "create", "edit", "delete"],
    check_in: ["view", "create"],
  },
  casino: {
    events: ["view"],
    notifications: ["view"],
    venues: ["view"],
    reservations: ["view", "create", "edit", "delete"],
    customers: ["view", "create", "edit", "delete"],
    check_in: ["view", "create"],
  },
};

export function ceilingOf(department: Department, module: Module): readonly Verb[] {
  return CEILING[department][module] ?? [];
}

// Yalnızca member düzeyindeki üyeliklerin tavan birleşimi.
export function grantableCeiling(memberships: readonly Membership[]): Partial<Record<Module, readonly Verb[]>> {
  const unions: Partial<Record<Module, Set<Verb>>> = {};
  for (const { department, level } of memberships) {
    if (level !== "member") continue;
    for (const mod of Object.keys(CEILING[department]) as Module[]) {
      const set = unions[mod] ?? new Set<Verb>();
      for (const verb of ceilingOf(department, mod)) set.add(verb);
      unions[mod] = set;
    }
  }
  const grants: Partial<Record<Module, readonly Verb[]>> = {};
  for (const mod of Object.keys(unions) as Module[]) {
    const set = unions[mod];
    const verbs = VERB_ORDER.filter((verb) => set?.has(verb));
    if (verbs.length > 0) grants[mod] = verbs;
  }
  return grants;
}
