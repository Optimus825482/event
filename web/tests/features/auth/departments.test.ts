import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  DEPARTMENT_LEVELS,
  LEVEL_LABELS,
  ceilingOf,
  grantableCeiling,
  type Department,
} from "@/features/auth/departments";
import type { Module, Verb } from "@/features/auth/policy";

// Tavan notasyonu: v=view c=create e=edit d=delete, "-" = yok (kapalı).
const VERB_CHARS = { v: "view", c: "create", e: "edit", d: "delete" } as const;
const toVerbs = (notation: string): Verb[] =>
  [...notation]
    .filter((ch) => ch !== "-")
    .map((ch) => VERB_CHARS[ch as keyof typeof VERB_CHARS]);

// Tablo elle yazıldı: 11 modül × 3 departman.
const MATRIX: Record<Department, Record<Module, string>> = {
  entertainment: {
    events: "vced", invitations: "vced", notifications: "vced", venues: "v---",
    staff: "----", reviews: "----", reservations: "----", customers: "----",
    check_in: "vc--", users: "----", settings: "----",
  },
  fnb: {
    events: "v---", invitations: "----", notifications: "v---", venues: "vced",
    staff: "vced", reviews: "vced", reservations: "----", customers: "----",
    check_in: "vc--", users: "----", settings: "----",
  },
  casino: {
    events: "v---", invitations: "----", notifications: "v---", venues: "v---",
    staff: "----", reviews: "----", reservations: "vced", customers: "vced",
    check_in: "vc--", users: "----", settings: "----",
  },
};

describe("departman tavanı", () => {
  it("sözlük sabittir", () => {
    expect(DEPARTMENTS).toEqual(["entertainment", "fnb", "casino"]);
    expect(DEPARTMENT_LEVELS).toEqual(["manager", "assistant", "member"]);
    expect(DEPARTMENT_LABELS).toEqual({ entertainment: "Entertainment", fnb: "Food & Beverage", casino: "Casino" });
    expect(LEVEL_LABELS).toEqual({ manager: "Yönetici", assistant: "Yönetici Asistanı", member: "Kullanıcı" });
  });
  it("matris tablodaki gibidir", () => {
    for (const d of DEPARTMENTS) {
      for (const m of Object.keys(MATRIX[d]) as Module[]) {
        expect(ceilingOf(d, m), `${d}/${m}`).toEqual(toVerbs(MATRIX[d][m]));
      }
    }
  });
  it("users ve settings hiçbir tavanda yoktur", () => {
    for (const d of DEPARTMENTS) for (const m of ["users", "settings"] as const) expect(ceilingOf(d, m)).toEqual([]);
  });
  it("grantableCeiling yalnızca member üyeliklerini birleştirir", () => {
    const g = grantableCeiling([{ department: "fnb", level: "member" }, { department: "casino", level: "manager" }]);
    expect(g.venues).toEqual(["view", "create", "edit", "delete"]);
    expect(g.reservations).toBeUndefined();
    expect(grantableCeiling([])).toEqual({});
  });
});
