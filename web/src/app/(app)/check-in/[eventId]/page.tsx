import type { Metadata } from "next";
import Link from "next/link";
import { CheckInConsole } from "@/features/check-in/components/check-in-console";
import { loadCheckInConsole } from "@/features/check-in/queries";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";

export const metadata: Metadata = { title: "Kapı girişi | EventFlow" };

type Params = Promise<{ eventId: string }>;

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function CheckInEventPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const { userId, event, stats, canWrite } = await loadCheckInConsole(eventId);
  const closed = event.status === "draft" || event.status === "cancelled";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <Link href="/check-in" className="text-sm text-muted-foreground hover:underline">
            ← Etkinlikler
          </Link>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {dateFormat.format(event.startsAt)} · {EVENT_STATUS_LABELS[event.status]}
          </p>
        </div>
      </div>
      {closed ? (
        <p role="alert" className="rounded-md border border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
          Bu etkinlik {EVENT_STATUS_LABELS[event.status].toLocaleLowerCase("tr-TR")} durumunda; check-in yapılamaz.
        </p>
      ) : null}
      <CheckInConsole
        eventId={event.id}
        userId={userId}
        initialStats={stats}
        canWrite={canWrite && !closed}
        readOnlyNote={!closed && !canWrite ? "Bu ekranda yalnızca görüntüleme yetkiniz var." : null}
      />
    </div>
  );
}
