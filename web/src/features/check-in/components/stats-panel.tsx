"use client";

import { Ban, CheckCircle2, Clock, Percent, UserX, Users, type LucideIcon } from "lucide-react";
import type { EventStats } from "../stats";

type Tone = "slate" | "emerald" | "amber" | "blue" | "red";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-700/50 text-slate-300",
  emerald: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  blue: "bg-blue-500/20 text-blue-400",
  red: "bg-red-500/20 text-red-400",
};

// Not: e2e, her kutuyu `div.rounded-lg` içindeki ilk iki `p` (etiket, değer) ile okur; yapıyı koruyun.
function Tile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-400">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
        </div>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** Canlı istatistikler: beklenen, giriş yapan, kalan, iptal, gelmedi ve kişi toplamları. */
export function StatsPanel({ stats, stale }: { stats: EventStats; stale: boolean }) {
  return (
    <section
      aria-label="İstatistikler"
      aria-busy={stale}
      className="space-y-3 border-b border-slate-700 pb-4"
    >
      <div className="flex items-end justify-between gap-3 text-xs text-slate-400">
        <span>
          {stats.checkedIn} / {stats.totalExpected} tamamlandı
        </span>
        <span>{stats.remaining} bekleniyor</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${stats.checkInPercentage}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Beklenen" value={stats.totalExpected} hint={`${stats.expectedGuests} kişi`} icon={Users} tone="slate" />
        <Tile
          label="Giriş yaptı"
          value={stats.checkedIn}
          hint={`${stats.checkedInGuests} kişi`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <Tile label="Kalan" value={stats.remaining} icon={Clock} tone="amber" />
        <Tile label="Oran" value={`%${stats.checkInPercentage}`} icon={Percent} tone="blue" />
        <Tile label="İptal" value={stats.cancelled} icon={Ban} tone="red" />
        <Tile label="Gelmedi" value={stats.noShow} icon={UserX} tone="slate" />
      </div>
    </section>
  );
}
