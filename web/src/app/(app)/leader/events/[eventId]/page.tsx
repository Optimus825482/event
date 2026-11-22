import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, LayoutGrid, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { LeaderEventPlan } from "@/features/reviews/components/leader-event-plan";
import {
  EventStatusBadge,
  formatDateTime,
  LeaderNoAccess,
  LeaderStat,
  Panel,
  SectionTitle,
} from "@/features/reviews/components/leader-ui";
import { orNotFound } from "@/features/reviews/leader-page";
import { getLeaderEventDetail } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";
import { isUuid } from "@/lib/identifiers";

export const metadata: Metadata = { title: "Etkinlik | Lider | EventFlow" };

export default async function LeaderEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const detail = await orNotFound(() => getLeaderEventDetail(db, actor, eventId));

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/leader/events" className="text-sm text-slate-400 hover:text-cyan-300 hover:underline">
        Etkinlikler
      </Link>
      <PageHeader
        className="mt-2"
        title={detail.event.name}
        description={formatDateTime(detail.event.startsAt)}
        actions={
          <>
            <EventStatusBadge status={detail.event.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/leader/reviews/${detail.event.id}`}>Değerlendir</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LeaderStat label="Takım" value={detail.teams.length} icon={<Users className="size-5" />} />
        <LeaderStat label="Ekip Üyesi" value={detail.memberCount} icon={<UserRound className="size-5" />} />
        <LeaderStat label="Atanan Masa" value={detail.assignedTableIds.length} icon={<LayoutGrid className="size-5" />} />
        <LeaderStat
          label="Toplam Misafir"
          value={detail.guestCount}
          icon={<ClipboardList className="size-5" />}
          hint="Atanan masalardaki aktif rezervasyonlar"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <SectionTitle>Masa yerleşimi</SectionTitle>
          <LeaderEventPlan
            plan={detail.plan}
            teams={detail.teams}
            assignedTableIds={detail.assignedTableIds}
            tableLabels={detail.tableLabels}
          />
        </Panel>
        <Panel>
          <SectionTitle>Ekibim</SectionTitle>
          <div className="space-y-4">
            {detail.teams.map((team) => (
              <div key={team.id}>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                  <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.name}
                </p>
                {team.members.length === 0 ? (
                  <p className="text-sm text-slate-500">Bu ekipte üye yok.</p>
                ) : (
                  <ul className="space-y-1">
                    {team.members.map((m) => (
                      <li key={m.staffId} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/leader/team/${m.staffId}`} className="text-slate-300 hover:text-cyan-300 hover:underline">
                          {m.fullName}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {m.tableIds.length > 0 ? `${m.tableIds.length} masa` : "Masa yok"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
