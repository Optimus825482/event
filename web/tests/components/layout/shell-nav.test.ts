import { describe, expect, it } from "vitest";
import { actorLabel } from "@/components/layout/role-labels";
import { buildShellNav } from "@/components/layout/shell-nav";
import { visibleNavGroups } from "@/features/auth/nav";
import type { PolicyActor } from "@/features/auth/policy";
import { adminActor, managerActor, memberActor, noAccessActor } from "../../helpers/actors";

describe("buildShellNav", () => {
  it("genel grubu modüllerden ayırır ve rol ya da lider varyantı taşımaz", () => {
    const nav = buildShellNav(visibleNavGroups(managerActor("fnb")));
    expect(nav.modules.map((g) => g.key)).toEqual(["fnb", "check_in"]);
    expect(nav.general.map((i) => i.href)).toEqual(["/notifications"]);
    expect("variant" in nav).toBe(false);
  });

  it("modül gruplarını etiket, vurgu ve öğeleriyle düz modele çevirir", () => {
    const nav = buildShellNav(visibleNavGroups(adminActor()));
    expect(nav.modules.map((g) => g.label)).toEqual([
      "Entertainment",
      "Food & Beverage",
      "Casino",
      "Check-in",
      "Sistem Yönetimi",
    ]);
    const fnb = nav.modules.find((g) => g.key === "fnb");
    expect(fnb?.extraPrefixes).toEqual(["/import/assignments", "/import/template"]);
    expect(fnb?.items[0]).toEqual({ href: "/fnb", label: "Etkinlikler", icon: "calendar" });
    expect(Object.keys(fnb ?? {}).sort()).toEqual(["accent", "extraPrefixes", "icon", "items", "key", "label"]);
  });

  it("kendi ekibiyle sınırlı F&B kullanıcısı yalnızca ekip öğelerini içeren tek modül görür", () => {
    const nav = buildShellNav(visibleNavGroups(memberActor("fnb", { reviews: "v---" }, { staffId: "s1" })));
    expect(nav.modules).toHaveLength(1);
    expect(nav.modules[0]?.items.map((i) => i.href)).toEqual([
      "/fnb/team",
      "/fnb/team/events",
      "/fnb/team/members",
      "/fnb/team/reviews",
      "/fnb/team/reports",
    ]);
  });

  it("üyeliksiz kullanıcı için boştur", () => {
    expect(buildShellNav(visibleNavGroups(noAccessActor()))).toEqual({ modules: [], general: [] });
  });
});

describe("actorLabel", () => {
  const withMemberships = (memberships: PolicyActor["memberships"]): PolicyActor => ({
    id: "u1",
    role: "user",
    staffId: null,
    memberships,
    permissions: [],
  });

  it("yönetici", () => {
    expect(actorLabel(adminActor())).toBe("Sistem Yöneticisi");
  });

  it("tek üyelik: departman · düzey", () => {
    expect(actorLabel(withMemberships([{ department: "casino", level: "manager" }]))).toBe("Casino · Yönetici");
    expect(actorLabel(withMemberships([{ department: "fnb", level: "assistant" }]))).toBe(
      "Food & Beverage · Yönetici Asistanı",
    );
  });

  it("çoklu üyelik: ilk departman +N", () => {
    expect(
      actorLabel(
        withMemberships([
          { department: "fnb", level: "member" },
          { department: "casino", level: "manager" },
        ]),
      ),
    ).toBe("Food & Beverage +1");
  });

  it("üyeliksiz kullanıcı", () => {
    expect(actorLabel(noAccessActor())).toBe("Kullanıcı");
  });

  it("üyelik bilgisi admin etiketini değiştirmez", () => {
    expect(actorLabel({ ...adminActor(), memberships: [{ department: "casino", level: "manager" }] })).toBe("Sistem Yöneticisi");
  });
});
