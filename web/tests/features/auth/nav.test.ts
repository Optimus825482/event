import { describe, expect, it, vi } from "vitest";
import { DEPARTMENTS, LEVEL_LABELS, type Department, type DepartmentLevel } from "@/features/auth/departments";
import { NAV_GROUPS, NAV_ITEMS, visibleNavGroups, visibleNavItems } from "@/features/auth/nav";
import { can, type PolicyActor } from "@/features/auth/policy";
import { adminActor, assistantActor, managerActor, memberActor, noAccessActor } from "../../helpers/actors";

vi.mock("@/features/sales-site/ready", () => ({ SALES_SITE_READY: false }));

const hrefs = (actor: PolicyActor) => visibleNavItems(actor).map((item) => item.href);
const groupKeys = (actor: PolicyActor) => visibleNavGroups(actor).map((group) => group.key);

describe("NAV_ITEMS", () => {
  it("gruplar ve öğeler tablodaki sıradadır", () => {
    expect(NAV_ITEMS.map((i) => [i.href, i.label, i.module, i.group])).toEqual([
      ["/dashboard", "Pano", "events", "entertainment"],
      ["/events", "Etkinlikler", "events", "entertainment"],
      ["/templates", "Davetiye Şablonları", "invitations", "entertainment"],
      ["/archive", "Arşiv", "archive", "entertainment"],
      ["/artists", "Sanatçılar", "archive", "entertainment"],
      ["/reports", "Raporlar", "archive", "entertainment"],
      ["/sales-site", "Satış Sitesi", "events", "entertainment"],
      ["/fnb", "Etkinlikler", "venues", "fnb"],
      ["/venues", "Yerleşim Şablonları", "venues", "fnb"],
      ["/staff", "Ekipler", "staff", "fnb"],
      ["/fnb/team", "Ekip Panosu", "reviews", "fnb"],
      ["/fnb/team/events", "Ekip Etkinlikleri", "reviews", "fnb"],
      ["/fnb/team/members", "Ekibim", "reviews", "fnb"],
      ["/fnb/team/reviews", "Değerlendirmeler", "reviews", "fnb"],
      ["/fnb/team/reports", "Raporlar", "reviews", "fnb"],
      ["/reservations", "Rezervasyonlar", "reservations", "casino"],
      ["/customers", "Müşteriler", "customers", "casino"],
      ["/guests", "Misafirler", "customers", "casino"],
      ["/check-in", "Check-in", "check_in", "check_in"],
      ["/admin", "Yönetim Paneli", "users", "admin"],
      ["/admin/users", "Kullanıcılar", "users", "admin"],
      ["/settings/table-types", "Masa Tipleri", "settings", "admin"],
      ["/admin/settings", "Sistem Ayarları", "settings", "admin"],
      ["/notifications", "Bildirimler", "notifications", "general"],
    ]);
    expect(NAV_ITEMS).toHaveLength(24);
  });

  it("Satış Sitesi öğesi bayrak kapalıyken admin dahil kimseye görünmez", () => {
    const item = NAV_ITEMS.find((i) => i.href === "/sales-site");
    expect(item?.ready).toBe(false);
    expect(hrefs(adminActor())).not.toContain("/sales-site");
    expect(hrefs(managerActor("entertainment"))).not.toContain("/sales-site");
  });

  it("arşiv öğeleri hazırdır; admin ve Entertainment yöneticisi görür, F&B görmez", () => {
    const items = NAV_ITEMS.filter((i) => i.module === "archive");
    expect(items.map((i) => [i.href, i.label, i.icon, i.ready])).toEqual([
      ["/archive", "Arşiv", "archive", true],
      ["/artists", "Sanatçılar", "music", true],
      ["/reports", "Raporlar", "bar-chart", true],
    ]);
    expect(hrefs(adminActor())).toContain("/archive");
    expect(hrefs(managerActor("entertainment"))).toContain("/reports");
    expect(hrefs(managerActor("fnb"))).not.toContain("/archive");
  });

  it("gruplar etiket, departman kapsamı ve ek önekleriyle tanımlıdır", () => {
    expect(NAV_GROUPS.map((g) => [g.key, g.label, g.departments])).toEqual([
      ["entertainment", "Entertainment", ["entertainment"]],
      ["fnb", "Food & Beverage", ["fnb"]],
      ["casino", "Casino", ["casino"]],
      ["check_in", "Check-in", null],
      ["admin", "Sistem Yönetimi", null],
      ["general", "Genel", null],
    ]);
    const prefixes = Object.fromEntries(NAV_GROUPS.map((g) => [g.key, g.extraPrefixes]));
    expect(prefixes.fnb).toEqual(["/import/assignments", "/import/template"]);
    expect(prefixes.casino).toEqual(["/import/reservations"]);
  });

  it("her öğenin simgesi ve her grubun vurgu rengi tanımlıdır", () => {
    for (const item of NAV_ITEMS) expect(item.icon).toBeTruthy();
    for (const group of NAV_GROUPS) expect(group.accent).toBeTruthy();
  });
});

describe("departman grupları", () => {
  it("F&B yöneticisi Entertainment grubunu görmez", () => {
    expect(groupKeys(managerActor("fnb"))).toEqual(["fnb", "check_in", "general"]);
  });

  it("Entertainment yöneticisi", () => {
    expect(groupKeys(managerActor("entertainment"))).toEqual(["entertainment", "check_in", "general"]);
  });

  it("Casino yöneticisi", () => {
    expect(groupKeys(managerActor("casino"))).toEqual(["casino", "check_in", "general"]);
  });

  it("başka departmanın grubundaki öğe, modül izni olsa bile görünmez (venues: Entertainment ve Casino görüntüler)", () => {
    expect(hrefs(managerActor("entertainment"))).not.toContain("/fnb");
    expect(hrefs(managerActor("casino"))).not.toContain("/venues");
  });

  it("Casino kullanıcısı yalnızca izinli öğeleri görür", () => {
    const a = memberActor("casino", { reservations: "v---" });
    expect(hrefs(a)).toEqual(["/reservations"]);
  });

  it("F&B yöneticisi menüdeki tüm F&B öğelerini görür", () => {
    expect(hrefs(managerActor("fnb"))).toEqual([
      "/fnb",
      "/venues",
      "/staff",
      "/fnb/team",
      "/fnb/team/events",
      "/fnb/team/members",
      "/fnb/team/reviews",
      "/fnb/team/reports",
      "/check-in",
      "/notifications",
    ]);
  });

  it("staffId'li F&B kullanıcısı ekip öğelerini görür", () => {
    const a = memberActor("fnb", { reviews: "vce-" }, { staffId: "s1" });
    expect(hrefs(a)).toEqual(["/fnb/team", "/fnb/team/events", "/fnb/team/members", "/fnb/team/reviews", "/fnb/team/reports"]);
  });

  it("staffId'siz F&B kullanıcısı ekip öğelerini görmez", () => {
    expect(hrefs(memberActor("fnb", { reviews: "vce-" }))).toEqual([]);
  });

  it("kendi ekibiyle sınırlı kullanıcı, izin verilen F&B öğeleriyle ekip öğelerini birlikte görür", () => {
    const a = memberActor("fnb", { reviews: "v---", venues: "v---", staff: "v---" }, { staffId: "s1" });
    expect(hrefs(a)).toEqual(["/venues", "/staff", "/fnb/team", "/fnb/team/events", "/fnb/team/members", "/fnb/team/reviews", "/fnb/team/reports"]);
  });

  it("events:view olmayan F&B kullanıcısı /fnb görmez, /venues görür", () => {
    const a = memberActor("fnb", { venues: "v---" });
    expect(hrefs(a)).toEqual(["/venues"]);
    expect(hrefs(memberActor("fnb", { venues: "v---", events: "v---" }))).toEqual(["/fnb", "/venues"]);
  });

  it("admin altı grubun hepsini görür", () => {
    expect(groupKeys(adminActor())).toEqual(["entertainment", "fnb", "casino", "check_in", "admin", "general"]);
    expect(hrefs(adminActor())).toEqual(NAV_ITEMS.filter((i) => i.ready !== false).map((i) => i.href));
  });

  it("üyeliksiz kullanıcı hiçbir grup görmez", () => {
    expect(visibleNavGroups(noAccessActor())).toEqual([]);
    expect(hrefs(noAccessActor())).toEqual([]);
  });

  it("çok departmanlı kullanıcı her iki grubu görür; üye olmadığı departmanı görmez", () => {
    const a: PolicyActor = {
      ...managerActor("casino"),
      memberships: [
        { department: "casino", level: "manager" },
        { department: "entertainment", level: "assistant" },
      ],
    };
    expect(groupKeys(a)).toEqual(["entertainment", "casino", "check_in", "general"]);
  });

  it("Masa Tipleri ve yönetim öğeleri yalnızca admine görünür", () => {
    for (const department of DEPARTMENTS) {
      expect(hrefs(managerActor(department))).not.toContain("/settings/table-types");
      expect(hrefs(managerActor(department))).not.toContain("/admin");
    }
  });
});

describe("kullanıcı düzeyi izinleri", () => {
  it("görüntüleme izni verilmeyen modül gizlenir", () => {
    const a = memberActor("casino", { reservations: "v---", check_in: "vc--" });
    expect(hrefs(a)).toEqual(["/reservations", "/check-in"]);
  });

  it("üyeliksiz kullanıcı hiçbir öğe görmez; izin satırı tek başına öğe açmaz", () => {
    expect(hrefs(noAccessActor())).toEqual([]);
    expect(hrefs(noAccessActor({ permissions: [{ module: "events", canView: true, canCreate: true, canEdit: true, canDelete: true }] }))).toEqual([]);
  });
});

describe("görünen her öğe erişilebilir bir sayfaya gider", () => {
  const levels: readonly DepartmentLevel[] = ["manager", "assistant", "member"];
  const actors: { name: string; actor: PolicyActor }[] = [
    { name: "admin", actor: adminActor() },
    { name: "üyeliksiz", actor: noAccessActor() },
    ...DEPARTMENTS.flatMap((department: Department) =>
      levels.map((level) => ({
        name: `${department} / ${LEVEL_LABELS[level]}`,
        actor:
          level === "manager"
            ? managerActor(department, { staffId: "s1" })
            : level === "assistant"
              ? assistantActor(department, { staffId: "s1" })
              : memberActor(department, { events: "v---", venues: "v---", reviews: "v---", reservations: "v---", check_in: "vc--" }, { staffId: "s1" }),
      })),
    ),
    { name: "çok departman", actor: { ...managerActor("fnb"), memberships: [{ department: "fnb", level: "member" }, { department: "casino", level: "manager" }], permissions: [{ module: "venues", canView: true, canCreate: false, canEdit: false, canDelete: false }] } },
  ];

  for (const { name, actor } of actors) {
    it(`${name}: her görünür öğe için görüntüleme izni vardır ve grup kapsamı uyar`, () => {
      for (const group of visibleNavGroups(actor)) {
        for (const item of group.items) {
          const resource = item.module === "reviews" && actor.staffId ? { reviewerStaffIds: [actor.staffId] } : undefined;
          expect(can(actor, item.module, "view", resource), `${item.href}`).toBe(true);
          if (item.alsoRequires) expect(can(actor, item.alsoRequires, "view"), `${item.href} ek izin`).toBe(true);
          if (group.departments !== null && actor.role === "user") {
            const member = (actor.memberships ?? []).some((m) => group.departments?.includes(m.department));
            expect(member, `${item.href} grup kapsamı`).toBe(true);
          }
        }
      }
    });
  }
});
