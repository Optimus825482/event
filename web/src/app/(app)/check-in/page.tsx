import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { loadCheckInEvents } from "@/features/check-in/queries";

export const metadata: Metadata = { title: "Check-in | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function CheckInEventsPage() {
  const events = await loadCheckInEvents();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Check-in</h1>
        <p className="text-sm text-muted-foreground">
          Giriş yapılacak etkinliği seçin. Devam eden ve bugünkü etkinlikler üsttedir.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Check-in yapılabilecek etkinlik yok. Yalnızca yayında, devam eden ya da son üç günde tamamlanmış etkinlikler
          listelenir.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/check-in/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted-foreground">{dateFormat.format(event.startsAt)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {event.isToday ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">Bugün</span>
                  ) : null}
                  <span className="rounded-full border border-border px-2 py-0.5">
                    {EVENT_STATUS_LABELS[event.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
