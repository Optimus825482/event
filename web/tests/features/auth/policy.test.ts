import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_LEVELS,
  DEPARTMENTS,
  type Department,
  type DepartmentLevel,
  type Membership,
} from "@/features/auth/departments";
import { ForbiddenError } from "@/features/auth/errors";
import {
  authorize,
  can,
  MODULES,
  VERBS,
  type Module,
  type PermissionRow,
  type PolicyActor,
} from "@/features/auth/policy";
import { ROLES } from "@/features/auth/roles";

// Fiil gösterimi: v=view c=create e=edit d=delete, "-" = ret. Kaynak verilmez.
type Row = Record<Module, string>;
const NONE = "----";
const VERB_CHARS = { view: "v", create: "c", edit: "e", delete: "d" } as const;

const m = (department: Department, level: DepartmentLevel): Membership => ({ department, level });

// "vce-" gibi dizgileri izin satırına çevirir.
const rowsFrom = (grants: Partial<Record<Module, string>>): PermissionRow[] =>
  (Object.entries(grants) as [Module, string][]).map(([module, flags]) => ({
    module,
    canView: flags.includes("v"),
    canCreate: flags.includes("c"),
    canEdit: flags.includes("e"),
    canDelete: flags.includes("d"),
  }));

const user = (
  memberships: Membership[],
  grants: Partial<Record<Module, string>> = {},
  staffId: string | null = null,
): PolicyActor => ({ id: "u1", role: "user" as const, staffId, memberships, permissions: rowsFrom(grants) });

const admin = (grants: Partial<Record<Module, string>> = {}): PolicyActor => ({
  id: "a1",
  role: "admin",
  staffId: null,
  memberships: [],
  permissions: rowsFrom(grants),
});

describe("roller", () => {
  it("yalnızca admin ve user vardır", () => {
    expect([...ROLES]).toEqual(["admin", "user"]);
  });

  it("beklenmeyen rol değeri (eski rol adı) yalnızca departman kurallarına uyar; users/settings kapalı", () => {
    // Eski oturum ya da göç edilmemiş satır: tür dışı rol admin sayılmaz.
    const legacy = { ...user([m("casino", "manager")], { users: "vced", settings: "vced" }), role: "organizer" } as unknown as PolicyActor;
    for (const verb of VERBS) {
      expect(can(legacy, "reservations", verb)).toBe(true);
      expect(can(legacy, "users", verb)).toBe(false);
      expect(can(legacy, "settings", verb)).toBe(false);
      expect(can(legacy, "events", verb)).toBe(verb === "view");
      expect(can(legacy, "staff", verb)).toBe(false);
    }
  });

  it("beklenmeyen rol değeri, üyelik yoksa izin satırına rağmen hiçbir şey yapamaz", () => {
    const legacy = { ...user([], { events: "vced", check_in: "vced" }), role: "venue_owner" } as unknown as PolicyActor;
    for (const mod of MODULES) for (const verb of VERBS) expect(can(legacy, mod, verb)).toBe(false);
  });
});

describe("admin", () => {
  for (const mod of MODULES) {
    it(`admin ${mod} -> vced`, () => {
      for (const verb of VERBS) expect(can(admin(), mod, verb)).toBe(true);
    });
  }

  it("izin satırları admini daraltmaz", () => {
    const a = admin({ events: NONE, users: NONE });
    for (const verb of VERBS) {
      expect(can(a, "events", verb)).toBe(true);
      expect(can(a, "users", verb)).toBe(true);
    }
  });

  it("admin değerlendirici kaynağından bağımsızdır", () => {
    expect(can(admin(), "reviews", "edit", { reviewerStaffIds: ["baska"] })).toBe(true);
  });
});

const CASES: [string, PolicyActor, Partial<Row>][] = [
  ["entertainment yönetici", user([m("entertainment", "manager")]),
    { events: "vced", invitations: "vced", notifications: "vced", venues: "v---", check_in: "vc--", ticketing: "vced", finance: "vced", archive: "vced" }],
  ["entertainment asistan", user([m("entertainment", "assistant")]),
    { events: "vce-", invitations: "vce-", notifications: "vce-", venues: "v---", check_in: "vc--", ticketing: "vce-", finance: "vce-", archive: "vce-" }],
  ["fnb yönetici", user([m("fnb", "manager")]),
    { events: "v---", venues: "vced", staff: "vced", reviews: "vced", check_in: "vc--", notifications: "v---" }],
  ["casino yönetici", user([m("casino", "manager")]),
    { events: "v---", reservations: "vced", customers: "vced", venues: "v---", check_in: "vc--", notifications: "v---" }],
  ["casino kullanıcı, tavan dışı izin yok sayılır",
    user([m("casino", "member")], { reservations: "vc--", staff: "vced" }), { reservations: "vc--" }],
  ["izinsiz kullanıcı", user([m("casino", "member")]), {}],
  ["iki departman birleşimi", user([m("fnb", "member"), m("casino", "manager")], { venues: "vce-" }),
    { venues: "vce-", events: "v---", reservations: "vced", customers: "vced", check_in: "vc--", notifications: "v---" }],
  ["üyeliksiz", user([]), {}],
  ["üyeliksiz, izin satırı da yetki vermez", user([], { events: "vced", reservations: "vced", check_in: "vc--" }), {}],
  ["casino asistan", user([m("casino", "assistant")]),
    { events: "v---", reservations: "vce-", customers: "vce-", venues: "v---", check_in: "vc--", notifications: "v---" }],
  ["entertainment kullanıcı, yalnızca check_in", user([m("entertainment", "member")], { check_in: "vc--" }),
    { check_in: "vc--" }],
];

describe("departman yetki matrisi", () => {
  for (const [name, actor, expected] of CASES) {
    for (const mod of MODULES) {
      for (const verb of VERBS) {
        const allowed = (expected[mod] ?? NONE).includes(VERB_CHARS[verb]);
        it(`${name}: ${mod} ${verb} -> ${allowed}`, () => {
          expect(can(actor, mod, verb)).toBe(allowed);
        });
      }
    }
  }
});

describe("yeni modüller (Faz 4–9)", () => {
  it("yeni modüller sıranın sonundadır", () => expect(MODULES.slice(-3)).toEqual(["ticketing", "finance", "archive"]));
  it.each(["ticketing", "finance", "archive"] as const)("%s: Entertainment yöneticisi dört fiili de alır, asistan silemez", (mod) => {
    for (const v of VERBS) expect(can(user([m("entertainment", "manager")]), mod, v)).toBe(true);
    expect(can(user([m("entertainment", "assistant")]), mod, "edit")).toBe(true);
    expect(can(user([m("entertainment", "assistant")]), mod, "delete")).toBe(false);
  });
  it.each(["fnb", "casino"] as const)("%s yöneticisi yeni modüllerin hiçbirini göremez", (d) => {
    for (const mod of ["ticketing", "finance", "archive"] as const) expect(can(user([m(d, "manager")]), mod, "view")).toBe(false);
  });
  it("Entertainment kullanıcısı yalnızca izin satırındaki bayrağı alır", () => {
    const a = user([m("entertainment", "member")], { ticketing: "v---" });
    expect([can(a, "ticketing", "view"), can(a, "ticketing", "edit"), can(a, "finance", "view")]).toEqual([true, false, false]);
  });
});

describe("departman kuralları", () => {
  it("asistan silemez", () => {
    expect(() => authorize(user([m("fnb", "assistant")]), "staff", "delete")).toThrow(ForbiddenError);
  });

  it("F&B kullanıcısı yalnızca değerlendirici kümesinde olduğu personele erişir", () => {
    const a = user([m("fnb", "member")], { reviews: "vce-" }, "s1");
    expect(can(a, "reviews", "view", { reviewerStaffIds: ["s0", "s1"] })).toBe(true);
    expect(can(a, "reviews", "view", { reviewerStaffIds: ["s2"] })).toBe(false);
    expect(can(a, "reviews", "view", { reviewerStaffIds: [] })).toBe(false);
    expect(can(a, "reviews", "view")).toBe(false);
  });

  it("eski teamLeaderStaffId alanı tanınmaz: kapalı başarısız olur", () => {
    const a = user([m("fnb", "member")], { reviews: "vce-" }, "s1");
    expect(can(a, "reviews", "view", { teamLeaderStaffId: "s1" } as never)).toBe(false);
  });

  it("staffId'siz F&B kullanıcısı kümede olmasa da erişemez", () => {
    const noStaff = user([m("fnb", "member")], { reviews: "vce-" });
    expect(can(noStaff, "reviews", "view", { reviewerStaffIds: [] })).toBe(false);
  });

  it("kümedeki kullanıcı izin satırında olmayan fiili alamaz", () => {
    const a = user([m("fnb", "member")], { reviews: "vce-" }, "s1");
    expect(can(a, "reviews", "delete", { reviewerStaffIds: ["s1"] })).toBe(false);
  });

  it("F&B yöneticisi tüm personele erişir", () => {
    expect(can(user([m("fnb", "manager")]), "reviews", "edit", { reviewerStaffIds: [] })).toBe(true);
  });

  it("izin satırı kısıt değildir: yöneticinin açık bayrakları kapatan satırı yok sayılır", () => {
    const a = user([m("entertainment", "manager")], { events: NONE });
    for (const verb of VERBS) expect(can(a, "events", verb)).toBe(true);
  });

  describe("users ve settings hiçbir departman aktörüne açılmaz", () => {
    for (const department of DEPARTMENTS) {
      for (const level of DEPARTMENT_LEVELS) {
        it(`${department} ${level}`, () => {
          const a = user([m(department, level)], { users: "vced", settings: "vced" });
          for (const mod of ["users", "settings"] as const) {
            for (const verb of VERBS) expect(can(a, mod, verb)).toBe(false);
          }
        });
      }
    }

    it("üç departmanda yönetici + tam izin satırı", () => {
      const a = user(
        [m("entertainment", "manager"), m("fnb", "manager"), m("casino", "manager")],
        { users: "vced", settings: "vced" },
      );
      for (const verb of VERBS) {
        expect(can(a, "users", verb)).toBe(false);
        expect(can(a, "settings", verb)).toBe(false);
      }
    });
  });
});

describe("authorize", () => {
  it("reddedilince ForbiddenError fırlatır", () => {
    expect(() => authorize(user([m("casino", "manager")]), "users", "view")).toThrow(ForbiddenError);
  });

  it("izin verilince undefined döner", () => {
    expect(authorize(admin(), "users", "view")).toBeUndefined();
  });
});
