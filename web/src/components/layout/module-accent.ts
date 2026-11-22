import type { NavAccent } from "@/features/auth/nav";

/**
 * Modül vurgu renkleri. Tailwind sınıfları taranabilsin diye tam metin olarak yazılır
 * (eski arayüzdeki `bg-{renk}-600` / rozet / simge kutusu kalıpları).
 */
export type AccentClasses = {
  /** Etkin menü öğesi. */
  active: string;
  /** Modül rozeti (kırıntı satırı). */
  badge: string;
  /** Simge rengi. */
  icon: string;
  /** Avatar zemini. */
  avatar: string;
  /** Profil menüsünde etkin modül. */
  menuActive: string;
};

export const ACCENT_CLASSES: Record<NavAccent, AccentClasses> = {
  blue: {
    active: "bg-blue-600 text-white",
    badge: "bg-blue-600/20 border-blue-500/30 text-blue-400",
    icon: "text-blue-400",
    avatar: "bg-blue-600",
    menuActive: "bg-blue-600/20 text-blue-300",
  },
  purple: {
    active: "bg-purple-600 text-white",
    badge: "bg-purple-600/20 border-purple-500/30 text-purple-400",
    icon: "text-purple-400",
    avatar: "bg-purple-600",
    menuActive: "bg-purple-600/20 text-purple-300",
  },
  emerald: {
    active: "bg-emerald-600 text-white",
    badge: "bg-emerald-600/20 border-emerald-500/30 text-emerald-400",
    icon: "text-emerald-400",
    avatar: "bg-emerald-600",
    menuActive: "bg-emerald-600/20 text-emerald-300",
  },
  amber: {
    active: "bg-amber-600 text-white",
    badge: "bg-amber-600/20 border-amber-500/30 text-amber-400",
    icon: "text-amber-400",
    avatar: "bg-amber-600",
    menuActive: "bg-amber-600/20 text-amber-300",
  },
  cyan: {
    active: "bg-cyan-500/20 text-cyan-400",
    badge: "bg-cyan-600/20 border-cyan-500/30 text-cyan-400",
    icon: "text-cyan-400",
    avatar: "bg-cyan-600",
    menuActive: "bg-cyan-600/20 text-cyan-300",
  },
  slate: {
    active: "bg-slate-700 text-white",
    badge: "bg-slate-700/40 border-slate-600/50 text-slate-300",
    icon: "text-slate-400",
    avatar: "bg-slate-600",
    menuActive: "bg-slate-700 text-white",
  },
};
