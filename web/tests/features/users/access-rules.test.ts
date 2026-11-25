import { describe, expect, it } from "vitest";
import type { Membership } from "@/features/auth/departments";
import type { PermissionRow } from "@/features/auth/policy";
import { checkAccess } from "@/features/users/access-rules";

const row = (module: PermissionRow["module"], flags: string): PermissionRow => ({
  module,
  canView: flags.includes("v"),
  canCreate: flags.includes("c"),
  canEdit: flags.includes("e"),
  canDelete: flags.includes("d"),
});
const fnbMember: Membership = { department: "fnb", level: "member" };
const casinoMember: Membership = { department: "casino", level: "member" };

describe("checkAccess", () => {
  it("sistem yöneticisine departman ya da izin atanmaz", () => {
    const msg = "Sistem yöneticisine departman ya da izin atanmaz";
    expect(checkAccess("admin", [fnbMember], [])).toBe(msg);
    expect(checkAccess("admin", [], [row("events", "v")])).toBe(msg);
  });

  it("user rolü en az bir departman ister", () => {
    expect(checkAccess("user", [], [])).toBe("En az bir departman seçin");
  });

  it("görüntüleme izni olmadan diğer izinler verilemez", () => {
    expect(checkAccess("user", [fnbMember], [row("venues", "-ce-")])).toBe(
      "Görüntüleme izni olmadan diğer izinler verilemez",
    );
  });

  it("tavan dışı izin reddedilir", () => {
    const msg = "Bu izin seçilen departmanların kapsamı dışında";
    expect(checkAccess("user", [fnbMember], [row("staff", "v"), row("reservations", "v")])).toBe(msg);
    expect(checkAccess("user", [casinoMember], [row("venues", "vc--")])).toBe(msg);
    expect(checkAccess("user", [fnbMember], [row("users", "v")])).toBe(msg);
    // Yönetici düzeyi izin satırıyla genişletilemez: tavan yalnızca member üyeliklerden gelir.
    expect(checkAccess("user", [{ department: "fnb", level: "manager" }], [row("staff", "v")])).toBe(msg);
  });

  it("geçerli örnekler null döner", () => {
    expect(checkAccess("admin", [], [])).toBeNull();
    expect(checkAccess("user", [fnbMember], [row("venues", "vce-")])).toBeNull();
    expect(
      checkAccess("user", [fnbMember, casinoMember], [row("reservations", "vc--"), row("venues", "v---")]),
    ).toBeNull();
    expect(checkAccess("user", [{ department: "entertainment", level: "manager" }], [])).toBeNull();
  });

  it("tüm bayrakları kapalı satır yok sayılır", () => {
    expect(checkAccess("user", [fnbMember], [row("reservations", "----")])).toBeNull();
  });
});
