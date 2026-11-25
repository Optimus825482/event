import { describe, expect, it } from "vitest";
import type { Department, DepartmentLevel, Membership } from "@/features/auth/departments";
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

const CASES: [string, PolicyActor, Partial<Row>][] = [
  ["entertainment yönetici", user([m("entertainment", "manager")]),
    { events: "vced", invitations: "vced", notifications: "vced", venues: "v---", check_in: "vc--" }],
  ["entertainment asistan", user([m("entertainment", "assistant")]),
    { events: "vce-", invitations: "vce-", notifications: "vce-", venues: "v---", check_in: "vc--" }],
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

describe("departman kuralları", () => {
  it("asistan silemez", () => {
    expect(() => authorize(user([m("fnb", "assistant")]), "staff", "delete")).toThrow(ForbiddenError);
  });

  it("F&B kullanıcısı yalnızca kendi ekibinin değerlendirmesine erişir", () => {
    const a = user([m("fnb", "member")], { reviews: "vce-" }, "s1");
    expect(can(a, "reviews", "view", { teamLeaderStaffId: "s1" })).toBe(true);
    expect(can(a, "reviews", "view", { teamLeaderStaffId: "s2" })).toBe(false);
    expect(can(a, "reviews", "view")).toBe(false);
  });

  it("staffId'siz F&B kullanıcısı hiçbir ekibe erişemez", () => {
    expect(can(user([m("fnb", "member")], { reviews: "vced" }), "reviews", "view", { teamLeaderStaffId: "s1" })).toBe(false);
  });

  it("F&B yöneticisi tüm ekiplere erişir", () => {
    expect(can(user([m("fnb", "manager")]), "reviews", "edit", { teamLeaderStaffId: "s9" })).toBe(true);
  });

  it("users ve settings hiçbir departman üyesine açılmaz", () => {
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
