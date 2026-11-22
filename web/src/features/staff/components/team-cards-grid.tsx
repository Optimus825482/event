import Link from "next/link";
import { CalendarDays, Crown, Users } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "@/domain/event-status";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import type { TeamCard } from "@/features/staffing/team-cards";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

/** "Ekipler" sekmesi: ekip kartları, lider, üye sayısı ve bağlı etkinlik bilgisi. */
export function TeamCardsGrid({ teams, canOrganize }: { teams: TeamCard[]; canOrganize: boolean }) {
  if (teams.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Henüz ekip yok"
        description="Ekipler, bir etkinliğin ekip organizasyonu ekranında oluşturulur."
      />
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <li key={team.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
            <h3 className="truncate font-medium text-white">{team.name}</h3>
          </div>
          <dl className="space-y-1.5 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Crown aria-hidden className="size-4 text-amber-400" />
              <dt className="sr-only">Lider</dt>
              <dd>{team.leaderName ?? "Lider atanmadı"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Users aria-hidden className="size-4 text-blue-400" />
              <dt className="sr-only">Üye sayısı</dt>
              <dd>{team.memberCount} üye</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-4 text-emerald-400" />
              <dt className="sr-only">Etkinlik</dt>
              <dd className="min-w-0">
                {team.eventId && team.eventName ? (
                  canOrganize ? (
                    <Link href={`/events/${team.eventId}/team-organization`} className="truncate hover:text-white hover:underline">
                      {team.eventName}
                    </Link>
                  ) : (
                    <span className="truncate">{team.eventName}</span>
                  )
                ) : (
                  "Genel ekip (etkinliğe bağlı değil)"
                )}
              </dd>
            </div>
          </dl>
          {team.eventId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {team.eventStartsAt ? (
                <span className="text-xs text-slate-500">{dateFormat.format(new Date(team.eventStartsAt))}</span>
              ) : null}
              {team.eventStatus ? (
                <Badge variant="outline">{EVENT_STATUS_LABELS[team.eventStatus as EventStatus] ?? team.eventStatus}</Badge>
              ) : null}
              <Badge variant="secondary">{team.assignmentCount} atama</Badge>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
