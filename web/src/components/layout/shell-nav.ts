import type { NavAccent, NavGroupView, NavIconName } from "@/features/auth/nav";
import type { Role } from "@/features/auth/roles";

/** Kabuğa (istemci bileşenlerine) geçen düz, serileştirilebilir menü modeli. */
export type ShellItem = { href: string; label: string; icon: NavIconName };
export type ShellGroup = {
  key: string;
  label: string;
  accent: NavAccent;
  icon: NavIconName;
  extraPrefixes: readonly string[];
  items: readonly ShellItem[];
};
export type ShellNav = {
  /** Modül menüsü (kimlik şeridi); boş olabilir. */
  modules: readonly ShellGroup[];
  /** Zil/profil menüsünden erişilen genel öğeler (Bildirimler). */
  general: readonly ShellItem[];
  variant: "default" | "leader";
};

const toItems = (group: NavGroupView): ShellItem[] =>
  group.items.map(({ href, label, icon }) => ({ href, label, icon }));

/**
 * Yetkiye göre süzülmüş modülleri kabuk modeline çevirir. Lider rolü eski arayüzdeki gibi
 * tek, camgöbeği kimlikli "Takım Lideri" menüsü görür (LeaderNavbar).
 */
export function buildShellNav(role: Role, groups: readonly NavGroupView[]): ShellNav {
  const general = groups.filter((g) => g.key === "general").flatMap(toItems);
  const modules = groups.filter((g) => g.key !== "general");

  if (role === "leader") {
    const items = modules.flatMap(toItems);
    return {
      variant: "leader",
      general,
      modules: items.length
        ? [{ key: "leader", label: "Takım Lideri", accent: "cyan", icon: "star", extraPrefixes: [], items }]
        : [],
    };
  }
  return { variant: "default", general, modules: modules.map((g) => ({ ...g, items: toItems(g) })) };
}
