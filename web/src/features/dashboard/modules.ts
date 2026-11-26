import { visibleNavGroups, type NavAccent, type NavGroupKey, type NavGroupView } from "@/features/auth/nav";
import { can, type PolicyActor } from "@/features/auth/policy";

export type LauncherIcon = "calendar" | "ticket" | "qr-code" | "shield" | "star";

export type LauncherModule = {
  key: NavGroupKey;
  name: string;
  description: string;
  icon: LauncherIcon;
  accent: NavAccent;
  href: string;
};

type LauncherDefinition = Omit<LauncherModule, "href">;

/** Modül kartları (ad, açıklama, renk, simge); gruplarla aynı sırada. */
const DEFINITIONS: readonly LauncherDefinition[] = [
  {
    key: "entertainment",
    name: "Entertainment",
    description: "Etkinlik, masa sınıflandırma, satış, finans ve arşiv",
    icon: "calendar",
    accent: "blue",
  },
  {
    key: "fnb",
    name: "Food & Beverage",
    description: "Salon yerleşimi, ekip organizasyonu ve ekip değerlendirmeleri",
    icon: "star",
    accent: "cyan",
  },
  {
    key: "casino",
    name: "Casino",
    description: "Misafir rezervasyonları, müşteriler ve QR bilet yönetimi",
    icon: "ticket",
    accent: "purple",
  },
  {
    key: "check_in",
    name: "Check-in",
    description: "QR kod okutma ve giriş kontrolü",
    icon: "qr-code",
    accent: "emerald",
  },
  {
    key: "admin",
    name: "Sistem Yönetimi",
    description: "Kullanıcı yönetimi, sistem ayarları ve raporlar",
    icon: "shield",
    accent: "amber",
  },
];

/** Panel sayfası yetkisi yoksa modülün ilk erişilebilir sayfasına gidilir. */
function targetHref(actor: PolicyActor, group: NavGroupView): string {
  const fallback = group.items[0]?.href ?? "/";
  if (group.key === "entertainment") return can(actor, "events", "view") ? "/dashboard" : fallback;
  if (group.key === "admin") {
    return can(actor, "users", "view") && can(actor, "settings", "view") ? "/admin" : fallback;
  }
  return fallback;
}

/** Aktörün görebildiği modül kartları (menüdeki görünür gruplardan türetilir). */
export function launcherModules(actor: PolicyActor, groups: readonly NavGroupView[]): LauncherModule[] {
  return DEFINITIONS.flatMap((definition) => {
    const group = groups.find((candidate) => candidate.key === definition.key);
    return group ? [{ ...definition, href: targetHref(actor, group) }] : [];
  });
}

/**
 * Giriş sonrası açılış: aktörün görebildiği tek bir modül grubu varsa doğrudan onun ilk sayfası,
 * aksi hâlde (çok grup ya da hiç) başlatıcı. `general` (bildirimler) modül sayılmaz.
 */
export function landingFor(actor: PolicyActor): string {
  const modules = visibleNavGroups(actor).filter((group) => group.key !== "general");
  const [only] = modules;
  return modules.length === 1 && only ? (only.items[0]?.href ?? "/") : "/";
}
