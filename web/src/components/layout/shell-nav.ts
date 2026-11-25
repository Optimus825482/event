import type { NavAccent, NavGroupView, NavIconName } from "@/features/auth/nav";

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
};

const toItems = (group: NavGroupView): ShellItem[] =>
  group.items.map(({ href, label, icon }) => ({ href, label, icon }));

/** Yetkiye göre süzülmüş grupları kabuk modeline çevirir; menü yalnızca görünür gruplardan türer. */
export function buildShellNav(groups: readonly NavGroupView[]): ShellNav {
  return {
    general: groups.filter((g) => g.key === "general").flatMap(toItems),
    modules: groups
      .filter((g) => g.key !== "general")
      .map((g) => ({
        key: g.key,
        label: g.label,
        accent: g.accent,
        icon: g.icon,
        extraPrefixes: g.extraPrefixes,
        items: toItems(g),
      })),
  };
}
