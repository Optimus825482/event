import { ArrowRight, MapPin, QrCode, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HeroCountdown } from "./hero-countdown";

export type HeroEvent = {
  id: string;
  name: string;
  startsAt: Date;
  reservationCount: number;
  tableCount: number;
  capacity: number;
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

const GRADIENT_LINK =
  "inline-flex h-14 items-center justify-center gap-3 rounded-md px-6 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]";

/** Yaklaşan etkinlik hero kartı (eski rezervasyon ana ekranı): geri sayım, özet çipleri ve kısayollar. */
export function ReservationsHero({ event, canCheckIn }: { event: HeroEvent; canCheckIn: boolean }) {
  return (
    <section
      aria-label="Yaklaşan etkinlik"
      className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-purple-950/50 to-slate-900 shadow-2xl shadow-purple-500/10"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>
      <div className="relative p-6 sm:p-8 md:p-10">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center md:mb-8">
          <div className="flex items-center gap-3">
            <span className="size-3 rounded-full bg-purple-400" aria-hidden />
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-purple-300/80">Yaklaşan Etkinlik</span>
          </div>
          {canCheckIn ? (
            <Link
              href="/check-in"
              className={cn(GRADIENT_LINK, "w-full bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-400 sm:w-auto")}
            >
              <QrCode className="size-5" />
              Check-in Modülü
            </Link>
          ) : null}
        </div>

        <h2 className="mb-2 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:mb-3 md:text-5xl">{event.name}</h2>
        <p className="mb-8 text-base font-medium text-purple-300/70 sm:text-lg md:mb-10">{dateFormat.format(event.startsAt)}</p>

        <div className="mb-8 md:mb-10">
          <HeroCountdown startsAt={event.startsAt.toISOString()} />
        </div>

        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          <Link
            href={`/reservations/${event.id}`}
            className={cn(GRADIENT_LINK, "bg-gradient-to-r from-purple-600 to-violet-600 px-8 shadow-purple-500/25 hover:from-purple-500 hover:to-violet-500")}
          >
            <Ticket className="size-5" />
            Rezervasyonları Yönet
            <ArrowRight className="size-5" />
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 md:text-base">
            <span className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
              <MapPin className="size-4 text-purple-400" />
              <span className="font-medium text-slate-200">{event.tableCount}</span> masa
            </span>
            <span className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
              <Users className="size-4 text-purple-400" />
              <span className="font-medium text-slate-200">{event.capacity}</span> kapasite
            </span>
            <span className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
              <Ticket className="size-4 text-purple-400" />
              <span className="font-medium text-slate-200">{event.reservationCount}</span> rezervasyon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
