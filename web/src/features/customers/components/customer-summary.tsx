import { Ban, CalendarCheck, Ticket, UserX } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { cn } from "@/lib/utils";
import { vipTier } from "../vip";
import { TagChips } from "./tag-chips";
import { APP_TIME_ZONE } from "@/lib/time-zone";

type Props = {
  fullName: string;
  vipScore: number;
  isBlacklisted: boolean;
  totalReservations: number;
  totalAttendedEvents: number;
  noShowCount: number;
  lastEventAt: Date | null;
  tags: string[];
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

/** Müşteri ayrıntı başlığı (eski VIP analizi): avatar, VIP seviyesi ve puan çubuğu, etiketler, sayaç kartları. */
export function CustomerSummary({ fullName, vipScore, isBlacklisted, totalReservations, totalAttendedEvents, noShowCount, lastEventAt, tags }: Props) {
  const tier = vipTier(vipScore);
  const score = Math.max(0, Math.min(100, vipScore));
  return (
    <section aria-label="Müşteri özeti" className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white"
          aria-hidden
        >
          {fullName.trim().charAt(0).toLocaleUpperCase("tr")}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-white">
            {fullName}
            {isBlacklisted ? (
              <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
                <Ban className="size-3" aria-hidden />
                Kara liste
              </span>
            ) : null}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded border px-2 py-0.5 text-xs font-medium", tier.className)}>{tier.label}</span>
            <TagChips tags={tags} />
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <div className="flex justify-between text-xs text-slate-400">
            <span>VIP puanı</span>
            <span className="font-semibold text-slate-200">{vipScore}/100</span>
          </div>
          <div
            role="progressbar"
            aria-label="VIP puanı"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            className="h-2 overflow-hidden rounded-full bg-slate-700"
          >
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400" style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="purple" icon={<Ticket className="size-5" />} value={totalReservations} label="Rezervasyon" />
        <StatCard tone="emerald" icon={<CalendarCheck className="size-5" />} value={totalAttendedEvents} label="Katılım" />
        <StatCard tone="red" icon={<UserX className="size-5" />} value={noShowCount} label="Gelmedi" />
        <StatCard
          tone="blue"
          icon={<CalendarCheck className="size-5" />}
          value={<span className="text-base">{lastEventAt ? dateFormat.format(lastEventAt) : "-"}</span>}
          label="Son Katılım"
        />
      </div>
    </section>
  );
}
