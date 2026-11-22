import { can, type Module, type PolicyActor } from "./policy";

export type NavItem = { href: string; label: string; module: Module };

/**
 * Uygulama menüsünün TEK kaynağı. Yeni sayfalar bu listeye eklenmez; `(app)` altındaki
 * rotalar zaten buradaki yollara karşılık gelir.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/events", label: "Etkinlikler", module: "events" },
  { href: "/reservations", label: "Rezervasyonlar", module: "reservations" },
  { href: "/check-in", label: "Check-in", module: "check_in" },
  { href: "/customers", label: "Müşteriler", module: "customers" },
  { href: "/staff", label: "Personel", module: "staff" },
  { href: "/venues", label: "Mekân Şablonları", module: "venues" },
  // Sayfa `settings` görüntüleme yetkisi ister (yalnızca yönetici); menü de aynı modüle bağlı.
  { href: "/settings/table-types", label: "Masa Tipleri", module: "settings" },
  { href: "/templates", label: "Davetiye Şablonları", module: "invitations" },
  { href: "/leader/reviews", label: "Değerlendirmeler", module: "reviews" },
  { href: "/notifications", label: "Bildirimler", module: "notifications" },
  { href: "/admin/users", label: "Kullanıcılar", module: "users" },
  { href: "/admin/settings", label: "Ayarlar", module: "settings" },
];

/** Aktörün `view` yetkisi olan menü öğeleri (liste sırası korunur). */
export function visibleNavItems(actor: PolicyActor): NavItem[] {
  return NAV_ITEMS.filter((item) => can(actor, item.module, "view", navResource(actor, item.module)));
}

// `reviews` modülünde lider yalnızca kendi ekibini görür; menüde modülün görünmesi için
// aktörün kendi ekibi varsayılır. Gerçek sahiplik denetimi sayfa/action içinde yapılır.
function navResource(actor: PolicyActor, module: Module) {
  if (module === "reviews" && actor.role === "leader" && actor.staffId !== null) {
    return { teamLeaderStaffId: actor.staffId };
  }
  return undefined;
}
