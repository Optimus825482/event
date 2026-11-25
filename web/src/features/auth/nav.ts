import type { Department } from "./departments";
import { can, type Module, type PolicyActor } from "./policy";
import { inDepartment, isDepartmentUser, ownTeamOnly } from "./scope";

/** Menü grupları: üç departman + yetkiyle açılan ortak gruplar. `general` yalnızca zil/profil menüsünden erişilir. */
export type NavGroupKey = "entertainment" | "fnb" | "casino" | "check_in" | "admin" | "general";
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
  | "bell"
  | "layout-dashboard"
  | "bar-chart";

export type NavItem = {
  href: string;
  label: string;
  /** Yetki modülü (`policy.ts`). */
  module: Module;
  /** Sayfa ayrıca bu modülün görüntüleme iznini de ister (örn. `/fnb` etkinlik listeler). */
  alsoRequires?: Module;
  group: NavGroupKey;
  icon: NavIconName;
};

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  accent: NavAccent;
  icon: NavIconName;
  /**
   * Doluysa grup yalnızca admine ve bu departmanların üyelerine görünür; `null` ise yalnızca
   * öğelerin modül izni belirler.
   */
  departments: readonly Department[] | null;
  /** Menüde öğesi olmayan ama bu modüle ait sayfa yolları (etkin modülü bulmak için). */
  extraPrefixes: readonly string[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  { key: "entertainment", label: "Entertainment", accent: "blue", icon: "calendar", departments: ["entertainment"], extraPrefixes: [] },
  { key: "fnb", label: "Food & Beverage", accent: "cyan", icon: "star", departments: ["fnb"], extraPrefixes: ["/import/assignments", "/import/template"] },
  { key: "casino", label: "Casino", accent: "purple", icon: "ticket", departments: ["casino"], extraPrefixes: ["/import/reservations"] },
  { key: "check_in", label: "Check-in", accent: "emerald", icon: "scan-line", departments: null, extraPrefixes: [] },
  { key: "admin", label: "Sistem Yönetimi", accent: "amber", icon: "shield", departments: null, extraPrefixes: ["/settings/organization"] },
  { key: "general", label: "Genel", accent: "slate", icon: "bell", departments: null, extraPrefixes: [] },
];

/**
 * Uygulama menüsünün TEK kaynağı. Yeni sayfalar bu listeye eklenmez; `(app)` altındaki
 * rotalar zaten buradaki yollara karşılık gelir.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Pano", module: "events", group: "entertainment", icon: "layout-template" },
  { href: "/events", label: "Etkinlikler", module: "events", group: "entertainment", icon: "calendar" },
  { href: "/templates", label: "Davetiye Şablonları", module: "invitations", group: "entertainment", icon: "mail" },
  { href: "/fnb", label: "Etkinlikler", module: "venues", alsoRequires: "events", group: "fnb", icon: "calendar" },
  { href: "/venues", label: "Yerleşim Şablonları", module: "venues", group: "fnb", icon: "layout-template" },
  { href: "/staff", label: "Ekipler", module: "staff", group: "fnb", icon: "users" },
  { href: "/leader", label: "Ekip Panosu", module: "reviews", group: "fnb", icon: "layout-dashboard" },
  { href: "/leader/events", label: "Ekip Etkinlikleri", module: "reviews", group: "fnb", icon: "calendar" },
  { href: "/leader/team", label: "Ekibim", module: "reviews", group: "fnb", icon: "users" },
  { href: "/leader/reviews", label: "Değerlendirmeler", module: "reviews", group: "fnb", icon: "star" },
  { href: "/leader/reports", label: "Raporlar", module: "reviews", group: "fnb", icon: "bar-chart" },
  { href: "/reservations", label: "Rezervasyonlar", module: "reservations", group: "casino", icon: "ticket" },
  { href: "/customers", label: "Müşteriler", module: "customers", group: "casino", icon: "user-round" },
  { href: "/guests", label: "Misafirler", module: "customers", group: "casino", icon: "contact" },
  { href: "/check-in", label: "Check-in", module: "check_in", group: "check_in", icon: "scan-line" },
  { href: "/admin", label: "Yönetim Paneli", module: "users", group: "admin", icon: "shield" },
  { href: "/admin/users", label: "Kullanıcılar", module: "users", group: "admin", icon: "users" },
  // Sayfa `settings` görüntüleme yetkisi ister (yalnızca yönetici); menü de aynı modüle bağlı.
  { href: "/settings/table-types", label: "Masa Tipleri", module: "settings", group: "admin", icon: "table" },
  { href: "/admin/settings", label: "Sistem Ayarları", module: "settings", group: "admin", icon: "settings" },
  { href: "/notifications", label: "Bildirimler", module: "notifications", group: "general", icon: "bell" },
];

export type NavGroupView = NavGroup & { items: NavItem[] };

const GROUPS_BY_KEY = new Map(NAV_GROUPS.map((group) => [group.key, group]));

/** Departman kapsamlı grup yalnızca üyesine görünür (admin ve eski roller kapsama bağlı değildir). */
function groupAllows(actor: PolicyActor, group: NavGroup): boolean {
  if (group.departments === null || !isDepartmentUser(actor)) return true;
  return group.departments.some((department) => inDepartment(actor, department));
}

/** Aktörün grubunu görebildiği ve `view` yetkisi olan menü öğeleri (liste sırası korunur). */
export function visibleNavItems(actor: PolicyActor): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    const group = GROUPS_BY_KEY.get(item.group);
    if (!group || !groupAllows(actor, group)) return false;
    if (item.alsoRequires && !can(actor, item.alsoRequires, "view")) return false;
    return can(actor, item.module, "view", navResource(actor, item.module));
  });
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
  if (module === "reviews" && ownTeamOnly(actor) && actor.staffId !== null) {
    return { teamLeaderStaffId: actor.staffId };
  }
  return undefined;
}
