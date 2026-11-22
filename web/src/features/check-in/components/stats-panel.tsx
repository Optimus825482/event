"use client";

import type { EventStats } from "../stats";

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Canlı istatistikler: beklenen, giriş yapan, kalan, iptal, gelmedi ve kişi toplamları. */
export function StatsPanel({ stats, stale }: { stats: EventStats; stale: boolean }) {
  return (
    <section aria-label="İstatistikler" aria-busy={stale} className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.checkInPercentage}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Beklenen" value={stats.totalExpected} hint={`${stats.expectedGuests} kişi`} />
        <Tile label="Giriş yaptı" value={stats.checkedIn} hint={`${stats.checkedInGuests} kişi`} />
        <Tile label="Kalan" value={stats.remaining} />
        <Tile label="Oran" value={`%${stats.checkInPercentage}`} />
        <Tile label="İptal" value={stats.cancelled} />
        <Tile label="Gelmedi" value={stats.noShow} />
      </div>
    </section>
  );
}
