import { CheckCircle2, ClipboardList, Layout, Mail, ScanLine, Timer, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { countdownParts } from "../board";

/** Geri sayım şeridi: kalan gün/saat/dakika; başlamış etkinlik için kısa bir durum cümlesi. */
export function CountdownBanner({ startsAt, endsAt, closed, now }: { startsAt: Date; endsAt: Date | null; closed: boolean; now: Date }) {
  const parts = countdownParts(startsAt, now);
  const running = !parts && !closed && (!endsAt || endsAt.getTime() > now.getTime());
  const tone = parts
    ? "border-blue-500/30 from-blue-600/20 to-purple-600/20"
    : running
      ? "border-green-500/30 from-green-600/20 to-emerald-600/20"
      : "border-slate-700 from-slate-800/60 to-slate-800/30";
  return (
    <section aria-label="Geri sayım" className={cn("rounded-xl border bg-gradient-to-r p-5", tone)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Timer className={cn("h-8 w-8", parts ? "text-blue-400" : running ? "text-green-400" : "text-slate-500")} aria-hidden />
          <p className="text-lg font-semibold text-white">
            {parts ? "Etkinliğe kalan süre" : running ? "Etkinlik şu anda devam ediyor" : "Etkinlik tarihi geçti"}
          </p>
        </div>
        {parts ? (
          <dl className="flex gap-3">
            {(
              [
                ["Gün", parts.days],
                ["Saat", parts.hours],
                ["Dakika", parts.minutes],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-16 rounded-lg bg-slate-900/60 px-3 py-2 text-center">
                <dd className="text-2xl font-bold text-white">{value}</dd>
                <dt className="text-xs text-slate-400">{label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function SummaryCard({
  href,
  icon,
  title,
  value,
  ready,
  readyLabel,
  pendingLabel,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  value: string;
  ready: boolean | null;
  readyLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-blue-500/50 hover:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">{icon}</span>
        {ready === null ? null : ready ? (
          <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            {readyLabel ?? "Hazır"}
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs text-amber-400">
            {pendingLabel ?? "Eksik"}
          </span>
        )}
      </div>
      <p className="mt-3 font-medium text-white group-hover:text-blue-300">{title}</p>
      <p className="text-sm text-slate-400">{value}</p>
    </Link>
  );
}

type SummaryProps = {
  eventId: string;
  tableCount: number;
  capacity: number;
  assignmentCount: number;
  reservationCount: number;
};

/** Alan, ekip ve rezervasyon özet kartları (ilgili alt sayfalara bağlanır) + davetiye/check-in kısayolları. */
export function EventSummaryCards({ eventId, tableCount, capacity, assignmentCount, reservationCount }: SummaryProps) {
  return (
    <section aria-label="Etkinlik bölümleri" className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          href={`/events/${eventId}/venue`}
          icon={<Layout className="h-5 w-5" aria-hidden />}
          title="Masa yerleşimi"
          value={tableCount > 0 ? `${tableCount} masa · ${capacity} kişi` : "Henüz yerleşim yok"}
          ready={tableCount > 0}
        />
        <SummaryCard
          href={`/events/${eventId}/team-organization`}
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="Ekip organizasyonu"
          value={assignmentCount > 0 ? `${assignmentCount} personel atandı` : "Henüz atama yok"}
          ready={assignmentCount > 0}
        />
        <SummaryCard
          href={`/reservations/${eventId}`}
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title="Rezervasyonlar"
          value={`${reservationCount} rezervasyon`}
          ready={null}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/events/${eventId}/invitation`}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
        >
          <Mail className="h-4 w-4" aria-hidden />
          Davetiye
        </Link>
        <Link
          href={`/check-in/${eventId}`}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
        >
          <ScanLine className="h-4 w-4" aria-hidden />
          Check-in
        </Link>
      </div>
    </section>
  );
}
