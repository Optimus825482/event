import { describe, expect, it } from "vitest";
import { can } from "@/features/auth/policy";
import { managerActor, memberActor } from "../../helpers/actors";

// Geçiş testi: `teamLeaderStaffId` Task 10'da kaldırıldığında bu dosya silinir.
describe("değerlendirme yetkisi değerlendirici kümesiyle verilir (reviewerStaffIds)", () => {
  const fnbUser = memberActor("fnb", { reviews: "vce-" }, { staffId: "s1" });

  it("değerlendirici kümesinde olan kullanıcı erişir", () =>
    expect(can(fnbUser, "reviews", "view", { reviewerStaffIds: ["s0", "s1"] })).toBe(true));

  it("kümede değilse ya da küme boşsa erişemez", () => {
    expect(can(fnbUser, "reviews", "view", { reviewerStaffIds: ["s2"] })).toBe(false);
    expect(can(fnbUser, "reviews", "view", { reviewerStaffIds: [] })).toBe(false);
    expect(can(fnbUser, "reviews", "view")).toBe(false);
  });

  it("eski teamLeaderStaffId kaynağı geçiş süresince çalışır", () =>
    expect(can(fnbUser, "reviews", "view", { teamLeaderStaffId: "s1" })).toBe(true));

  it("F&B yöneticisi kaynaktan bağımsız erişir", () =>
    expect(can(managerActor("fnb"), "reviews", "edit", { reviewerStaffIds: [] })).toBe(true));

  it("staffId'siz kullanıcı kümede null olsa bile erişemez", () => {
    const noStaff = memberActor("fnb", { reviews: "vce-" });
    expect(can(noStaff, "reviews", "view", { reviewerStaffIds: [] })).toBe(false);
  });

  it("kümedeki kullanıcı izin satırında olmayan fiili alamaz", () =>
    expect(can(fnbUser, "reviews", "delete", { reviewerStaffIds: ["s1"] })).toBe(false));
});
