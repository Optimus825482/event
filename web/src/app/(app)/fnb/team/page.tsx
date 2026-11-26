import type { Metadata } from "next";
import Link from "next/link";
import { Award, CalendarDays, ClipboardCheck, Users, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import {
  EventStatusBadge,
  formatDateTime,
  LeaderNoAccess,
  LeaderStat,
  Panel,
  SectionTitle,
} from "@/features/reviews/components/leader-ui";
import { getLeaderDashboard } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";
import { REVIEW_ROUTES } from "@/features/reviews/routes";

export const metadata: Metadata = { title: "Lider Paneli | EventFlow" };

export default async function LeaderDashboardPage() {
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const data = await getLeaderDashboard(db, actor);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hoş geldin, ${actor.username}`}
        description="Lider Paneli"
        icon={
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <Award aria-hidden className="size-6" />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LeaderStat label="Takım" value={data.teamCount} icon={<UsersRound className="size-5" />} />
        <LeaderStat label="Ekip Üyesi" value={data.memberCount} icon={<Users className="size-5" />} />
        <LeaderStat label="Atanan Etkinlik" value={data.eventCount} icon={<CalendarDays className="size-5" />} />
        <LeaderStat
          label="Bekleyen Değerlendirme"
          value={data.pendingReviewEvents}
          icon={<ClipboardCheck className="size-5" />}
          hint="Değerlendirmesi açık etkinlik sayısı"
        />
      </div>

      {data.teamCount === 0 && data.eventCount === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="Henüz bir takımınız yok"
          description="Bir etkinlikte ekip lideri olarak atandığınızda takımınız ve etkinlikleriniz burada görünür."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-1">
            <SectionTitle>Sıradaki etkinlik</SectionTitle>
            {data.next && data.countdown ? (
              <div className="space-y-3">
                <p className="font-medium text-white">{data.next.name}</p>
                <p className="text-sm text-slate-400">{formatDateTime(data.next.startsAt)}</p>
                <div className="flex gap-3">
                  <div className="rounded-lg bg-cyan-500/10 px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-cyan-300">{data.countdown.days}</p>
                    <p className="text-xs text-slate-400">GÜN</p>
                  </div>
                  <div className="rounded-lg bg-cyan-500/10 px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-cyan-300">{data.countdown.hours}</p>
                    <p className="text-xs text-slate-400">SAAT</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Yaklaşan etkinlik yok.</p>
            )}
          </Panel>
          <Panel className="lg:col-span-2">
            <SectionTitle>Yaklaşan etkinlikler</SectionTitle>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Atanmış yaklaşan etkinlik yok.</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={REVIEW_ROUTES.event(event.id)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 p-3 transition-colors hover:border-cyan-500/40 hover:bg-slate-800 focus-visible:outline-2"
                    >
                      <span>
                        <span className="block font-medium text-white">{event.name}</span>
                        <span className="block text-sm text-slate-400">{formatDateTime(event.startsAt)}</span>
                      </span>
                      <EventStatusBadge status={event.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
