import type { ReactNode } from "react";
import type { EventStatus } from "@/domain/event-status";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { cn } from "@/lib/utils";
import { TREND_LABELS, type Trend } from "../leader-stats";
import { BAND_LABELS } from "../labels";
import type { RatingBand } from "../score";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const dateOnly = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** Lider paneli istatistik kartı: camgöbeği vurgulu (eski lider arayüzü). */
export function LeaderStat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="truncate text-xs text-slate-400 sm:text-sm">{label}</p>
        </div>
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const label = EVENT_STATUS_LABELS[status as EventStatus] ?? status;
  return (
    <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
      {label}
    </Badge>
  );
}

const BAND_TONE: Record<RatingBand, string> = {
  very_bad: "border-red-500/30 bg-red-500/20 text-red-300",
  bad: "border-orange-500/30 bg-orange-500/20 text-orange-300",
  average: "border-amber-500/30 bg-amber-500/20 text-amber-300",
  good: "border-cyan-500/30 bg-cyan-500/20 text-cyan-300",
  successful: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
  excellent: "border-emerald-400/40 bg-emerald-500/25 text-emerald-200",
};

export function ScoreBadge({ score, band }: { score: number; band: RatingBand }) {
  return (
    <Badge variant="outline" className={cn(BAND_TONE[band])}>
      {score} · {BAND_LABELS[band]}
    </Badge>
  );
}

export function TrendText({ trend }: { trend: Trend | null }) {
  if (!trend) return <span className="text-slate-500">Yeterli veri yok</span>;
  const tone = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-300";
  return <span className={tone}>{TREND_LABELS[trend]}</span>;
}

/** Lider paneli açılamadığında (bağlı personel kaydı yok ya da yetki yok). */
export function LeaderNoAccess() {
  return (
    <EmptyState
      title="Lider paneli kullanılamıyor"
      description="Hesabınız bir personel kaydına bağlı değil ya da bu bölüme yetkiniz yok. Yöneticinizle iletişime geçin."
    />
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-white">{children}</h2>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-slate-700 bg-slate-800/50 p-4", className)}>{children}</div>;
}
