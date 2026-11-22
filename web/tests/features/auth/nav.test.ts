import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, visibleNavGroups, visibleNavItems } from "@/features/auth/nav";
import { ROLES, type Role } from "@/features/auth/roles";

function actor(role: Role, staffId: string | null = null) {
  return { id: "u1", role, staffId };
}

function hrefs(role: Role, staffId: string | null = null): string[] {
  return visibleNavItems(actor(role, staffId)).map((item) => item.href);
}

describe("NAV_ITEMS", () => {
  it("modül gruplarıyla belirtilen sırada 19 öğe içerir", () => {
    expect(NAV_ITEMS.map((i) => [i.href, i.label, i.module, i.group])).toEqual([
      ["/dashboard", "Pano", "events", "events"],
      ["/events", "Etkinlikler", "events", "events"],
      ["/staff", "Ekipler", "staff", "events"],
      ["/venues", "Şablonlar", "venues", "events"],
      ["/templates", "Davetiye Şablonları", "invitations", "events"],
      ["/leader", "Pano", "reviews", "leader"],
      ["/leader/events", "Etkinlikler", "reviews", "leader"],
      ["/leader/team", "Ekip", "reviews", "leader"],
      ["/leader/reviews", "Değerlendirmeler", "reviews", "leader"],
      ["/leader/reports", "Raporlar", "reviews", "leader"],
      ["/reservations", "Rezervasyonlar", "reservations", "reservations"],
      ["/customers", "Müşteriler", "customers", "reservations"],
      ["/guests", "Misafirler", "customers", "reservations"],
      ["/check-in", "Check-in", "check_in", "check_in"],
      ["/admin", "Yönetim Paneli", "users", "admin"],
      ["/admin/users", "Kullanıcılar", "users", "admin"],
      ["/settings/table-types", "Masa Tipleri", "settings", "admin"],
      ["/admin/settings", "Sistem Ayarları", "settings", "admin"],
      ["/notifications", "Bildirimler", "notifications", "general"],
    ]);
  });

  it("her öğenin simgesi ve her grubun vurgu rengi tanımlıdır", () => {
    for (const item of NAV_ITEMS) expect(item.icon).toBeTruthy();
    for (const group of NAV_GROUPS) expect(group.accent).toBeTruthy();
  });
});

describe("visibleNavItems", () => {
  it("admin tüm öğeleri görür", () => {
    expect(hrefs("admin")).toEqual(NAV_ITEMS.map((i) => i.href));
  });

  it("organizer yönetim ve ayar modülleri (settings, users) hariç hepsini görür", () => {
    expect(hrefs("organizer")).toEqual(
      NAV_ITEMS.filter((i) => i.module !== "settings" && i.module !== "users").map((i) => i.href),
    );
  });

  it("Masa Tipleri yalnızca sayfanın istediği settings yetkisine sahip yöneticide görünür", () => {
    expect(hrefs("admin")).toContain("/settings/table-types");
    for (const role of ROLES.filter((r) => r !== "admin")) {
      expect(hrefs(role, "s1")).not.toContain("/settings/table-types");
    }
  });

  it("staff yalnızca rezervasyon, müşteri, misafir ve check-in öğelerini görür", () => {
    expect(hrefs("staff")).toEqual(["/reservations", "/customers", "/guests", "/check-in"]);
  });

  it("leader check-in, değerlendirme ve bildirimleri görür", () => {
    expect(hrefs("leader", "s1")).toEqual([
      "/leader",
      "/leader/events",
      "/leader/team",
      "/leader/reviews",
      "/leader/reports",
      "/check-in",
      "/notifications",
    ]);
  });

  it("controller yalnızca check-in görür", () => {
    expect(hrefs("controller")).toEqual(["/check-in"]);
  });

  it("venue_owner yalnızca mekân şablonlarını görür", () => {
    expect(hrefs("venue_owner")).toEqual(["/venues"]);
  });

  it("kullanıcıya özel görüntüleme yetkisi kaldırılan modül gizlenir", () => {
    const items = visibleNavItems({
      ...actor("staff"),
      permissions: [
        { module: "customers", canView: false, canCreate: false, canEdit: false, canDelete: false },
      ],
    });
    expect(items.map((i) => i.href)).toEqual(["/reservations", "/check-in"]);
  });

  it("her rol için tanımlıdır", () => {
    for (const role of ROLES) expect(Array.isArray(visibleNavItems(actor(role)))).toBe(true);
  });
});

describe("visibleNavGroups", () => {
  it("admin tüm modülleri ve genel grubu görür", () => {
    expect(visibleNavGroups(actor("admin")).map((g) => g.key)).toEqual(["events", "leader", "reservations", "check_in", "admin", "general"]);
  });

  it("yetkisiz modül atılır; öğesi olmayan grup listelenmez", () => {
    expect(visibleNavGroups(actor("controller")).map((g) => g.key)).toEqual(["check_in"]);
    expect(visibleNavGroups(actor("organizer")).map((g) => g.key)).not.toContain("admin");
  });

  it("/guests rezervasyon modülünde, müşteri yetkisiyle görünür", () => {
    const reservations = visibleNavGroups(actor("staff")).find((g) => g.key === "reservations");
    expect(reservations?.items.map((i) => i.href)).toContain("/guests");
  });
});
