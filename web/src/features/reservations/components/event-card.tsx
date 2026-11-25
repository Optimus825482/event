import { ArrowRight, Calendar, Ticket } from "lucide-react";
import Link from "next/link";
import type { EventStatus } from "@/domain/event-status";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export type EventCardData = {
  id: string;
  name: string;
  status: EventStatus;
  startsAt: Date;
  reservationCount: number;
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

/** Etkinlik kartı (eski `EventCard`): ad, tarih, rezervasyon sayısı ve durum rozeti. */
export function ReservationEventCard({ event }: { event: EventCardData }) {
  return (
    <Link
      href={`/reservations/${event.id}`}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 transition-all hover:border-purple-500/40 hover:bg-slate-800"
    >
      <div className="min-w-0 space-y-2">
        <p className="truncate text-lg font-semibold text-white">{event.name}</p>
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="size-4 text-purple-400" />
          {dateFormat.format(event.startsAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Ticket className="size-4 text-purple-400" />
            {event.reservationCount} rezervasyon
          </span>
          <span className="rounded-full border border-purple-500/30 px-2 py-0.5 text-xs text-purple-300">
            {EVENT_STATUS_LABELS[event.status]}
          </span>
        </div>
      </div>
      <ArrowRight className="size-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-purple-300" />
    </Link>
  );
}
