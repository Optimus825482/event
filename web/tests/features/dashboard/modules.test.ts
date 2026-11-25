import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "@/features/auth/departments";
import { visibleNavGroups } from "@/features/auth/nav";
import type { PolicyActor } from "@/features/auth/policy";
import { landingFor, launcherModules } from "@/features/dashboard/modules";
import { countdownParts } from "@/components/dashboard/countdown";
import { adminActor, assistantActor, managerActor, memberActor, noAccessActor } from "../../helpers/actors";

const cards = (a: PolicyActor) => launcherModules(a, visibleNavGroups(a));
const keys = (a: PolicyActor) => cards(a).map((m) => m.key);

describe("launcherModules", () => {
  it("yönetici beş modül kartını görür", () => {
    expect(keys(adminActor())).toEqual(["entertainment", "fnb", "casino", "check_in", "admin"]);
  });

  it("F&B yöneticisi Food & Beverage ve Check-in kartlarını görür", () => {
    const a = managerActor("fnb");
    expect(keys(a)).toEqual(["fnb", "check_in"]);
    expect(cards(a)[0]).toMatchObject({ name: "Food & Beverage", href: "/fnb" });
  });

  it("Entertainment yöneticisi panoya, Casino yöneticisi rezervasyonlara gider", () => {
    expect(cards(managerActor("entertainment"))[0]).toMatchObject({ key: "entertainment", href: "/dashboard" });
    expect(cards(managerActor("casino"))[0]).toMatchObject({ key: "casino", href: "/reservations" });
  });

  it("panel adreslerine yönlendirir", () => {
    const hrefs = Object.fromEntries(cards(adminActor()).map((m) => [m.key, m.href]));
    expect(hrefs).toMatchObject({ entertainment: "/dashboard", fnb: "/fnb", casino: "/reservations", admin: "/admin", check_in: "/check-in" });
  });

  it("etkinlik izni olmayan Entertainment kullanıcısı için panoyu atlar", () => {
    const a = memberActor("entertainment", { invitations: "v---" });
    expect(cards(a)).toEqual([expect.objectContaining({ key: "entertainment", href: "/templates" })]);
  });

  it("üyeliksiz kullanıcı hiç kart görmez", () => {
    expect(cards(noAccessActor())).toEqual([]);
  });

  it("kendi ekibiyle sınırlı F&B kullanıcısı yalnızca erişebildiği ekip panosuna gider", () => {
    const a = memberActor("fnb", { reviews: "v---" }, { staffId: "s1" });
    expect(cards(a)).toEqual([expect.objectContaining({ key: "fnb", href: "/leader" })]);
  });

  it("her kartın adresi, o grubun görünür öğelerinden biridir", () => {
    const actors: PolicyActor[] = [
      adminActor(),
      noAccessActor(),
      ...DEPARTMENTS.flatMap((d) => [managerActor(d, { staffId: "s1" }), assistantActor(d, { staffId: "s1" }), memberActor(d, { events: "v---", reviews: "v---", reservations: "v---" }, { staffId: "s1" })]),
      memberActor("casino", { check_in: "vc--" }),
    ];
    for (const a of actors) {
      const groups = visibleNavGroups(a);
      for (const card of launcherModules(a, groups)) {
        const group = groups.find((g) => g.key === card.key);
        expect(group?.items.map((i) => i.href), card.key).toContain(card.href);
      }
    }
  });
});

describe("landingFor", () => {
  it("tek modül grubu varsa onun ilk öğesi", () => {
    expect(landingFor(memberActor("casino", { reservations: "v---" }))).toBe("/reservations");
    expect(landingFor(memberActor("fnb", { reviews: "v---" }, { staffId: "s1" }))).toBe("/leader");
  });

  it("events:view olmayan F&B kullanıcısı /venues sayfasına iner; kart da oraya gider", () => {
    const a = memberActor("fnb", { venues: "v---" });
    expect(landingFor(a)).toBe("/venues");
    expect(cards(a)).toEqual([expect.objectContaining({ key: "fnb", href: "/venues" })]);
  });

  it("bildirim grubu modül sayılmaz", () => {
    expect(landingFor(memberActor("casino", { reservations: "v---", notifications: "v---" }))).toBe("/reservations");
  });

  it("çok grup ya da hiç grup varsa ana sayfa", () => {
    expect(landingFor(adminActor())).toBe("/");
    expect(landingFor(managerActor("fnb"))).toBe("/");
    expect(landingFor(noAccessActor())).toBe("/");
  });

  it("çok departmanlı kullanıcı ana sayfaya gider", () => {
    const a: PolicyActor = {
      ...managerActor("casino"),
      memberships: [
        { department: "casino", level: "member" },
        { department: "entertainment", level: "member" },
      ],
      permissions: [
        { module: "reservations", canView: true, canCreate: false, canEdit: false, canDelete: false },
        { module: "events", canView: true, canCreate: false, canEdit: false, canDelete: false },
      ],
    };
    expect(landingFor(a)).toBe("/");
  });

  it("yalnızca check-in yetkili kullanıcı check-in sayfasına iner", () => {
    expect(landingFor(memberActor("casino", { check_in: "vc--" }))).toBe("/check-in");
  });
});

describe("countdownParts", () => {
  it("kalan süreyi parçalar, geçmişte sıfırlar", () => {
    const now = Date.UTC(2027, 0, 1);
    expect(countdownParts(now + (2 * 86_400 + 3 * 3_600 + 4 * 60 + 5) * 1000, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
    expect(countdownParts(now - 1000, now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
