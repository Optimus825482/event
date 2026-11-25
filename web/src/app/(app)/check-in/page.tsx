import { CalendarDays, ChevronRight, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { loadCheckInEvents } from "@/features/check-in/queries";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Check-in | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

export default async function CheckInEventsPage() {
  const events = await loadCheckInEvents();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Check-in"
        description="Giriş yapılacak etkinliği seçin. Devam eden ve bugünkü etkinlikler üsttedir."
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </div>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden="true" />}
          title="Etkinlik seçilmedi"
          description="Check-in yapılabilecek etkinlik yok. Yalnızca yayında, devam eden ya da son üç günde tamamlanmış etkinlikler listelenir."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/check-in/${event.id}`}
                className="group flex h-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-gradient-to-br from-emerald-500/10 via-slate-800 to-slate-800 p-4 transition-colors hover:border-emerald-500/50"
              >
                <div className="min-w-0 space-y-2">
                  <p className="truncate font-medium text-white">{event.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {dateFormat.format(event.startsAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {event.isToday ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                        Bugün
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-slate-500 transition-colors group-hover:text-emerald-400"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
