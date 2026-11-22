import { Map as MapIcon, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
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
    <div className="mx-auto max-w-5xl">
      <Link href="/check-in" className="mb-3 inline-block text-sm text-slate-400 hover:text-white">
        ← Etkinlikler
      </Link>
      <PageHeader
        title={event.name}
        description={`${dateFormat.format(event.startsAt)} · ${EVENT_STATUS_LABELS[event.status]}`}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        actions={
          <Link
            href={`/check-in/${event.id}/plan`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
          >
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Alan planı
          </Link>
        }
      />
      {closed ? (
        <p role="alert" className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
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
