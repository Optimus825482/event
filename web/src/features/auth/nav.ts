import { can, type Module, type PolicyActor } from "./policy";

/** Menü modülleri (eski arayüzdeki modül şeridi). `general` yalnızca zil/profil menüsünden erişilir. */
export type NavGroupKey = "events" | "reservations" | "check_in" | "admin" | "general";
export type NavAccent = "blue" | "purple" | "emerald" | "amber" | "cyan" | "slate";
/** Lucide simge anahtarı; sunucudan istemciye bileşen geçirilemediğinden ad olarak taşınır. */
export type NavIconName =
  | "calendar"
  | "users"
  | "layout-template"
  | "mail"
  | "star"
  | "ticket"
  | "user-round"
  | "contact"
  | "scan-line"
  | "shield"
  | "settings"
  | "table"
  | "bell";

export type NavItem = {
  href: string;
  label: string;
  /** Yetki modülü (`policy.ts`). */
  module: Module;
  group: NavGroupKey;
  icon: NavIconName;
};

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  accent: NavAccent;
  icon: NavIconName;
  /** Menüde öğesi olmayan ama bu modüle ait sayfa yolları (etkin modülü bulmak için). */
  extraPrefixes: readonly string[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  { key: "events", label: "Etkinlik Planlama", accent: "blue", icon: "calendar", extraPrefixes: ["/import/assignments", "/import/template"] },
  { key: "reservations", label: "Rezervasyon", accent: "purple", icon: "ticket", extraPrefixes: ["/import/reservations"] },
  { key: "check_in", label: "Check-in", accent: "emerald", icon: "scan-line", extraPrefixes: [] },
  { key: "admin", label: "Sistem Yönetimi", accent: "amber", icon: "shield", extraPrefixes: ["/settings/organization"] },
  { key: "general", label: "Genel", accent: "slate", icon: "bell", extraPrefixes: [] },
];

/**
 * Uygulama menüsünün TEK kaynağı. Yeni sayfalar bu listeye eklenmez; `(app)` altındaki
 * rotalar zaten buradaki yollara karşılık gelir. Etiketler eski arayüzdeki adlandırmayı izler.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/events", label: "Etkinlikler", module: "events", group: "events", icon: "calendar" },
  { href: "/staff", label: "Ekipler", module: "staff", group: "events", icon: "users" },
  { href: "/venues", label: "Şablonlar", module: "venues", group: "events", icon: "layout-template" },
  { href: "/templates", label: "Davetiye Şablonları", module: "invitations", group: "events", icon: "mail" },
  { href: "/leader/reviews", label: "Değerlendirmeler", module: "reviews", group: "events", icon: "star" },
  { href: "/reservations", label: "Rezervasyonlar", module: "reservations", group: "reservations", icon: "ticket" },
  { href: "/customers", label: "Müşteriler", module: "customers", group: "reservations", icon: "user-round" },
  { href: "/guests", label: "Misafirler", module: "customers", group: "reservations", icon: "contact" },
  { href: "/check-in", label: "Check-in", module: "check_in", group: "check_in", icon: "scan-line" },
  { href: "/admin/users", label: "Kullanıcılar", module: "users", group: "admin", icon: "users" },
  // Sayfa `settings` görüntüleme yetkisi ister (yalnızca yönetici); menü de aynı modüle bağlı.
  { href: "/settings/table-types", label: "Masa Tipleri", module: "settings", group: "admin", icon: "table" },
  { href: "/admin/settings", label: "Sistem Ayarları", module: "settings", group: "admin", icon: "settings" },
  { href: "/notifications", label: "Bildirimler", module: "notifications", group: "general", icon: "bell" },
];

export type NavGroupView = NavGroup & { items: NavItem[] };

/** Aktörün `view` yetkisi olan menü öğeleri (liste sırası korunur). */
export function visibleNavItems(actor: PolicyActor): NavItem[] {
  return NAV_ITEMS.filter((item) => can(actor, item.module, "view", navResource(actor, item.module)));
}

/** Görünür öğeleri modüllere böler; öğesi olmayan modül atılır. */
export function visibleNavGroups(actor: PolicyActor): NavGroupView[] {
  const items = visibleNavItems(actor);
  return NAV_GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.group === group.key) })).filter(
    (group) => group.items.length > 0,
  );
}

// `reviews` modülünde lider yalnızca kendi ekibini görür; menüde modülün görünmesi için
// aktörün kendi ekibi varsayılır. Gerçek sahiplik denetimi sayfa/action içinde yapılır.
function navResource(actor: PolicyActor, module: Module) {
  if (module === "reviews" && actor.role === "leader" && actor.staffId !== null) {
    return { teamLeaderStaffId: actor.staffId };
  }
  return undefined;
}
