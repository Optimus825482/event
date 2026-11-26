import { CalendarDays, Layout, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { FNB_LIST_LIMIT, listEventsForFnb } from "@/features/events/fnb-list";
import { StageBadge } from "@/features/planning/components/stage-badge";
import { canOpenTeamOrganization } from "@/features/staffing/team-organization-access";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Etkinlikler | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const linkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "border-slate-600 bg-transparent");

/** F&B etkinlik listesi: her etkinlik için salon yerleşimi ve ekip organizasyonu bağlantıları. */
export default async function FnbEventsPage() {
  const actor = await requirePolicyActor();
  const { rows: events, truncated } = await listEventsForFnb(db, actor);
  // Hedef sayfalar `events:view` ister (ekip organizasyonu ayrıca `staff:view`); izni olmayana bağlantı verilmez.
  const canLayout = can(actor, "events", "view");
  const canTeams = canOpenTeamOrganization(actor);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Etkinlikler"
        description="Yaklaşan etkinliklerin salon yerleşimi ve ekip organizasyonu"
        icon={
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
            <CalendarDays aria-hidden className="size-5" />
          </div>
        }
      />
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden />}
          title="Yaklaşan etkinlik yok"
          description="Yeni bir etkinlik planlandığında burada listelenir."
        />
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-medium text-white">{event.name}</h2>
                  <StageBadge stage={event.planningStage} status={event.status} />
                </div>
                <p className="text-sm text-slate-400">{dateFormat.format(event.startsAt)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {event.hasLayout ? `${event.tableCount} masa` : "Masa yok"} · {event.teamCount} ekip
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canLayout ? (
                  <Link href={`/events/${event.id}/venue`} className={linkClass}>
                    <Layout aria-hidden className="size-4" />
                    Salon yerleşimi
                  </Link>
                ) : null}
                {canTeams ? (
                  <Link href={`/events/${event.id}/team-organization`} className={linkClass}>
                    <Users aria-hidden className="size-4" />
                    Ekip organizasyonu
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {truncated ? <p className="mt-3 text-sm text-slate-400">İlk {FNB_LIST_LIMIT} etkinlik gösteriliyor.</p> : null}
    </div>
  );
}
