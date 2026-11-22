import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "emerald" | "amber" | "purple" | "red" | "slate";

const TONES: Record<StatTone, string> = {
  blue: "bg-blue-500/20 text-blue-400",
  emerald: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  purple: "bg-purple-500/20 text-purple-400",
  red: "bg-red-500/20 text-red-400",
  slate: "bg-slate-700/50 text-slate-300",
};

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  hint?: string;
  className?: string;
};

/** İstatistik kartı: renkli simge kutusu, büyük sayı ve etiket (eski dashboard kartları). */
export function StatCard({ label, value, icon, tone = "blue", hint, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-700 bg-slate-800/50 p-4", className)}>
      <div className="flex items-center gap-3">
        {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>{icon}</div>}
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="truncate text-xs text-slate-400 sm:text-sm">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
