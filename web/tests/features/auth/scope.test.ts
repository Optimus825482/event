import { describe, expect, it } from "vitest";
import type { Department, DepartmentLevel, Membership } from "@/features/auth/departments";
import type { PolicyActor } from "@/features/auth/policy";
import { ROLES, type Role } from "@/features/auth/roles";
import { inDepartment, isAdmin, ownTeamOnly, seesOnlyOwnEvents } from "@/features/auth/scope";

const m = (department: Department, level: DepartmentLevel): Membership => ({ department, level });

const actor = (role: Role, memberships?: Membership[]): PolicyActor => ({
  id: "u1",
  role,
  staffId: null,
  ...(memberships ? { memberships } : {}),
});

describe("isAdmin", () => {
  for (const role of ROLES) {
    it(`${role} -> ${role === "admin"}`, () => {
      expect(isAdmin({ role })).toBe(role === "admin");
    });
  }
});

describe("seesOnlyOwnEvents", () => {
  for (const role of ROLES) {
    it(`${role} -> ${role === "organizer"}`, () => {
      expect(seesOnlyOwnEvents({ role })).toBe(role === "organizer");
    });
  }
});

describe("inDepartment", () => {
  const a = actor("user", [m("fnb", "assistant"), m("casino", "member")]);
  const CASES: [string, Department, readonly DepartmentLevel[] | undefined, boolean][] = [
    ["düzey verilmeden üye olduğu departman", "fnb", undefined, true],
    ["düzey verilmeden üye olmadığı departman", "entertainment", undefined, false],
    ["eşleşen düzey", "fnb", ["manager", "assistant"], true],
    ["eşleşmeyen düzey", "casino", ["manager", "assistant"], false],
    ["tek düzey eşleşmesi", "casino", ["member"], true],
    ["boş düzey listesi", "fnb", [], false],
  ];
  for (const [name, department, levels, expected] of CASES) {
    it(`${name} -> ${expected}`, () => {
      expect(inDepartment(a, department, levels)).toBe(expected);
    });
  }

  it("üyelik alanı olmayan aktör hiçbir departmanda değildir", () => {
    expect(inDepartment(actor("organizer"), "fnb")).toBe(false);
  });
});

describe("ownTeamOnly", () => {
  const CASES: [string, PolicyActor, boolean][] = [
    ["leader", actor("leader"), true],
    ["admin", actor("admin"), false],
    ["organizer", actor("organizer"), false],
    ["staff", actor("staff"), false],
    ["controller", actor("controller"), false],
    ["venue_owner", actor("venue_owner"), false],
    ["F&B yöneticisi", actor("user", [m("fnb", "manager")]), false],
    ["F&B asistanı", actor("user", [m("fnb", "assistant")]), false],
    ["F&B kullanıcısı", actor("user", [m("fnb", "member")]), true],
    ["F&B üyeliği olmayan kullanıcı", actor("user", [m("casino", "manager")]), true],
    ["üyeliksiz kullanıcı", actor("user", []), true],
    ["F&B yöneticisi + başka departman kullanıcısı", actor("user", [m("entertainment", "member"), m("fnb", "manager")]), false],
  ];
  for (const [name, a, expected] of CASES) {
    it(`${name} -> ${expected}`, () => {
      expect(ownTeamOnly(a)).toBe(expected);
    });
  }
});
