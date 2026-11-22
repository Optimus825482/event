import { Calendar, QrCode, Shield, Star, Ticket, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { NavAccent } from "@/features/auth/nav";
import type { LauncherIcon, LauncherModule } from "@/features/dashboard/modules";

const ICONS: Record<LauncherIcon, LucideIcon> = {
  calendar: Calendar,
  ticket: Ticket,
  "qr-code": QrCode,
  shield: Shield,
  star: Star,
};

type CardColors = { gradient: string; iconBg: string; border: string; glow: string; icon: string };

// Tailwind sınıfları taranabilsin diye tam metin (eski select-module renkleri).
const COLORS: Record<NavAccent, CardColors> = {
  blue: {
    gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
    iconBg: "bg-blue-600/20",
    border: "border-blue-500/30 hover:border-blue-400/60",
    glow: "hover:shadow-blue-500/20",
    icon: "text-blue-400",
  },
  purple: {
    gradient: "from-purple-500/20 via-purple-600/10 to-transparent",
    iconBg: "bg-purple-600/20",
    border: "border-purple-500/30 hover:border-purple-400/60",
    glow: "hover:shadow-purple-500/20",
    icon: "text-purple-400",
  },
  emerald: {
    gradient: "from-emerald-500/20 via-emerald-600/10 to-transparent",
    iconBg: "bg-emerald-600/20",
    border: "border-emerald-500/30 hover:border-emerald-400/60",
    glow: "hover:shadow-emerald-500/20",
    icon: "text-emerald-400",
  },
  amber: {
    gradient: "from-amber-500/20 via-amber-600/10 to-transparent",
    iconBg: "bg-amber-600/20",
    border: "border-amber-500/30 hover:border-amber-400/60",
    glow: "hover:shadow-amber-500/20",
    icon: "text-amber-400",
  },
  cyan: {
    gradient: "from-cyan-500/20 via-cyan-600/10 to-transparent",
    iconBg: "bg-cyan-600/20",
    border: "border-cyan-500/30 hover:border-cyan-400/60",
    glow: "hover:shadow-cyan-500/20",
    icon: "text-cyan-400",
  },
  slate: {
    gradient: "from-slate-500/20 via-slate-600/10 to-transparent",
    iconBg: "bg-slate-600/20",
    border: "border-slate-500/30 hover:border-slate-400/60",
    glow: "hover:shadow-slate-500/20",
    icon: "text-slate-400",
  },
};

/** Modül seçim kartı: degrade zemin, renkli simge kutusu, ad ve açıklama. */
export function ModuleCard({ module }: { module: LauncherModule }) {
  const colors = COLORS[module.accent];
  const Icon = ICONS[module.icon];
  return (
    <Link
      href={module.href}
      className={`group relative block overflow-hidden rounded-xl border bg-linear-to-br p-5 text-left backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:rounded-2xl sm:p-6 lg:p-7 ${colors.gradient} ${colors.border} ${colors.glow}`}
    >
      <div className="relative z-10">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 sm:mb-5 sm:h-14 sm:w-14 sm:rounded-xl lg:mb-6 lg:h-16 lg:w-16 ${colors.iconBg}`}
        >
          <Icon aria-hidden="true" className={`h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${colors.icon}`} />
        </div>
        <h2 className="mb-1.5 text-lg font-semibold text-white sm:mb-2 sm:text-xl">{module.name}</h2>
        <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">{module.description}</p>
      </div>
    </Link>
  );
}
