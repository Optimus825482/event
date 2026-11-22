import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db/client";
import { EVENT_STATUSES } from "@/domain/event-status";
import { requirePolicyActor } from "@/features/auth/permissions";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { EventStatusBadge, formatDateTime, LeaderNoAccess } from "@/features/reviews/components/leader-ui";
import { listLeaderEvents } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";

export const metadata: Metadata = { title: "Etkinlikler | Lider | EventFlow" };

function first(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

export default async function LeaderEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const raw = await searchParams;
  const search = first(raw.search);
  const rawStatus = first(raw.status);
  const status = EVENT_STATUSES.find((s) => s === rawStatus);
  const events = await listLeaderEvents(db, actor, { search, status });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Etkinlikler" description="Ekibinizin görev aldığı etkinlikler" />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="search" className="mb-1 block text-xs text-slate-400">
            Etkinlik ara
          </label>
          <Input id="search" name="search" type="search" defaultValue={search ?? ""} placeholder="Etkinlik adı" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs text-slate-400">
            Durum
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          >
            <option value="">Tüm durumlar</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Etkinlik bulunamadı"
          description="Kriterlere uyan atanmış etkinlik yok. Bir etkinlikte ekip lideri olarak atandığınızda burada görünür."
        />
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/leader/events/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-cyan-500/40 hover:bg-slate-800 focus-visible:outline-2"
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">{event.name}</p>
                  <p className="text-sm text-slate-400">
                    {formatDateTime(event.startsAt)} · {event.teamCount} ekip · {event.memberCount} üye
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <EventStatusBadge status={event.status} />
                  {event.reviewEnabled ? (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      {event.completedCount}/{event.memberCount} değerlendirildi
                    </Badge>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
