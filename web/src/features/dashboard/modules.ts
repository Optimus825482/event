import type { NavAccent, NavGroupKey, NavGroupView } from "@/features/auth/nav";
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

/** Eski `select-module` sayfasındaki modül kartları (ad, açıklama, renk, simge). */
const DEFINITIONS: readonly LauncherDefinition[] = [
  {
    key: "events",
    name: "Etkinlik Planlama",
    description: "Etkinlik oluşturma, masa yerleşimi ve personel yönetimi",
    icon: "calendar",
    accent: "blue",
  },
  {
    key: "leader",
    name: "Ekip Lideri",
    description: "Ekibinizin etkinlikleri, değerlendirmeleri ve raporları",
    icon: "star",
    accent: "cyan",
  },
  {
    key: "reservations",
    name: "Rezervasyon",
    description: "Misafir rezervasyonları ve QR bilet yönetimi",
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
  if (group.key === "events") return can(actor, "events", "view") ? "/dashboard" : fallback;
  if (group.key === "leader") return "/leader";
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

/** Eski arayüzdeki rol yönlendirmeleri: bu roller modül seçmez, doğrudan çalışma alanına gider. */
export function roleLanding(role: PolicyActor["role"]): string | null {
  if (role === "leader") return "/leader";
  if (role === "controller") return "/check-in";
  if (role === "venue_owner") return "/venues";
  return null;
}
