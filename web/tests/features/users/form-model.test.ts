import { describe, expect, it } from "vitest";
import type { Membership } from "@/features/auth/departments";
import type { PermissionRow } from "@/features/auth/policy";
import { accessSummary, permissionGrid, pruneGrants } from "@/features/users/form-model";

const fnbMember: Membership = { department: "fnb", level: "member" };
const casinoMember: Membership = { department: "casino", level: "member" };

function row(module: PermissionRow["module"], verbs: ("view" | "create" | "edit" | "delete")[]): PermissionRow {
  return {
    module,
    canView: verbs.includes("view"),
    canCreate: verbs.includes("create"),
    canEdit: verbs.includes("edit"),
    canDelete: verbs.includes("delete"),
  };
}

describe("permissionGrid", () => {
  it("Entertainment kullanıcısı için izin tablosu yeni modülleri etiketleriyle içerir", () => {
    const grid = permissionGrid([{ department: "entertainment", level: "member" }]);
    expect(grid.slice(-3).map((r) => [r.module, r.label])).toEqual([
      ["ticketing", "Bilet ve Satış"],
      ["finance", "Finans"],
      ["archive", "Arşiv ve Raporlar"],
    ]);
  });

  it("F&B kullanıcısı için tavandaki modülleri PERMISSION_MODULES sırasıyla verir", () => {
    const grid = permissionGrid([fnbMember]);
    expect(grid.map((g) => g.module)).toEqual(["events", "notifications", "venues", "staff", "reviews", "check_in"]);
    const verbs = (module: string) => grid.find((g) => g.module === module)?.verbs;
    const full = ["view", "create", "edit", "delete"];
    expect(verbs("venues")).toEqual(full);
    expect(verbs("staff")).toEqual(full);
    expect(verbs("reviews")).toEqual(full);
    expect(verbs("events")).toEqual(["view"]);
    expect(verbs("notifications")).toEqual(["view"]);
    expect(verbs("check_in")).toEqual(["view", "create"]);
    expect(grid.find((g) => g.module === "venues")?.label).toBe("Mekânlar");
  });

  it("yönetici ve asistan üyelikleri tabloya modül eklemez", () => {
    expect(permissionGrid([{ department: "fnb", level: "manager" }])).toEqual([]);
    expect(permissionGrid([{ department: "fnb", level: "assistant" }])).toEqual([]);
  });

  it("birden çok departmanın tavanı birleşir", () => {
    const grid = permissionGrid([fnbMember, casinoMember]);
    expect(grid.find((g) => g.module === "venues")?.verbs).toEqual(["view", "create", "edit", "delete"]);
    expect(grid.map((g) => g.module)).toContain("customers");
  });
});

describe("pruneGrants", () => {
  it("üyelik kalkınca tavan dışı modül satırını atar", () => {
    const grants = [row("venues", ["view", "edit"]), row("reservations", ["view"])];
    expect(pruneGrants(grants, [casinoMember])).toEqual([row("venues", ["view"]), row("reservations", ["view"])]);
    expect(pruneGrants(grants, [])).toEqual([]);
  });

  it("tavan dışındaki fiilleri kapatır", () => {
    expect(pruneGrants([row("events", ["view", "edit"])], [fnbMember])).toEqual([row("events", ["view"])]);
  });

  it("tavan içindeki satırlara dokunmaz; yönetici düzeyi tüm satırları atar", () => {
    const grants = [row("venues", ["view", "create"]), row("check_in", ["view", "create"])];
    expect(pruneGrants(grants, [fnbMember])).toEqual(grants);
    expect(pruneGrants(grants, [{ department: "fnb", level: "manager" }])).toEqual([]);
  });
});

describe("accessSummary", () => {
  it("sistem yöneticisi", () => {
    expect(accessSummary("admin", [])).toBe("Sistem Yöneticisi");
  });

  it("departman ve düzeyleri sırayla yazar", () => {
    expect(
      accessSummary("user", [
        { department: "fnb", level: "manager" },
        { department: "casino", level: "member" },
      ]),
    ).toBe("Food & Beverage · Yönetici, Casino · Kullanıcı");
    expect(accessSummary("user", [{ department: "entertainment", level: "assistant" }])).toBe(
      "Entertainment · Yönetici Asistanı",
    );
  });

  it("üyeliksiz kullanıcı", () => {
    expect(accessSummary("user", [])).toBe("Departman atanmamış");
  });
});
