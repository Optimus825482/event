import { describe, expect, it } from "vitest";
import { NAV_ITEMS, visibleNavItems } from "@/features/auth/nav";
import { ROLES, type Role } from "@/features/auth/roles";

function actor(role: Role, staffId: string | null = null) {
  return { id: "u1", role, staffId };
}

function hrefs(role: Role, staffId: string | null = null): string[] {
  return visibleNavItems(actor(role, staffId)).map((item) => item.href);
}

describe("NAV_ITEMS", () => {
  it("belirtilen sırayla 12 öğe içerir", () => {
    expect(NAV_ITEMS.map((i) => [i.href, i.label, i.module])).toEqual([
      ["/events", "Etkinlikler", "events"],
      ["/reservations", "Rezervasyonlar", "reservations"],
      ["/check-in", "Check-in", "check_in"],
      ["/customers", "Müşteriler", "customers"],
      ["/staff", "Personel", "staff"],
      ["/venues", "Mekân Şablonları", "venues"],
      ["/settings/table-types", "Masa Tipleri", "settings"],
      ["/templates", "Davetiye Şablonları", "invitations"],
      ["/leader/reviews", "Değerlendirmeler", "reviews"],
      ["/notifications", "Bildirimler", "notifications"],
      ["/admin/users", "Kullanıcılar", "users"],
      ["/admin/settings", "Ayarlar", "settings"],
    ]);
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

  it("staff yalnızca rezervasyon, check-in ve müşterileri görür", () => {
    expect(hrefs("staff")).toEqual(["/reservations", "/check-in", "/customers"]);
  });

  it("leader check-in, değerlendirme ve bildirimleri görür", () => {
    expect(hrefs("leader", "s1")).toEqual(["/check-in", "/leader/reviews", "/notifications"]);
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
