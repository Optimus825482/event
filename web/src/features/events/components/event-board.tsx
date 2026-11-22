import { Calendar, CheckCircle2, Clock, MapPin, Timer, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BOARD_TABS,
  BOARD_TAB_CONFIG,
  countdownLabel,
  eventTypeBadge,
  hasTeam,
  hasVenue,
  type BoardEvent,
  type BoardTab,
} from "../board";
import { CreateEventDialog, EventRowActions } from "./event-dialogs";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

const ACTIVE_TAB_CLASS: Record<BoardTab, string> = {
  planning: "bg-amber-600 text-white",
  upcoming: "bg-green-600 text-white",
  completed: "bg-slate-600 text-white",
};

const READY = "gap-1.5 border-green-500/30 bg-green-500/20 px-3 py-1 text-green-400 hover:bg-green-500/30";
const PENDING = "gap-1.5 border-amber-500/30 bg-amber-500/20 px-3 py-1 text-amber-400 hover:bg-amber-500/30";

function tabHref(tab: BoardTab, search: string | undefined): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (search) params.set("search", search);
  return `/events?${params.toString()}`;
}

type Props = {
  groups: Record<BoardTab, BoardEvent[]>;
  activeTab: BoardTab;
  search: string | undefined;
  now: Date;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

/** Eski etkinlik listesi: üç durum sekmesi, 12 sütunlu satırlar, hazırlık ve geri sayım rozetleri. */
export function EventBoard({ groups, activeTab, search, now, canCreate, canEdit, canDelete }: Props) {
  const rows = groups[activeTab];
  const config = BOARD_TAB_CONFIG[activeTab];
  return (
    <div className="space-y-6">
      <nav aria-label="Etkinlik durumları" className="flex gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-1">
        {BOARD_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Link
              key={tab}
              href={tabHref(tab, search)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                active ? ACTIVE_TAB_CLASS[tab] : "text-slate-400 hover:bg-slate-700/50 hover:text-white",
              )}
            >
              {BOARD_TAB_CONFIG[tab].label}
              <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-white/20" : "bg-slate-700")}>
                {groups[tab].length}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 px-6 py-3">
          {activeTab === "planning" && canCreate ? <CreateEventDialog /> : null}
          <p className="flex-1 text-center text-sm text-slate-500">{config.description}</p>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-600" aria-hidden />
            <p className="text-slate-400">{search ? "Aramanıza uyan etkinlik yok" : config.emptyText}</p>
            {activeTab !== "planning" ? (
              <Link
                href={tabHref("planning", search)}
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 border-slate-600 bg-transparent")}
              >
                Planlama Aşamasına Git
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-12 gap-4 border-b border-slate-700 px-6 py-4 text-sm font-medium text-slate-400">
                <div className="col-span-2">Tarih & Saat</div>
                <div className="col-span-3">Etkinlik</div>
                <div className="col-span-2 text-center">Tür</div>
                <div className="col-span-1 text-center">Alan</div>
                <div className="col-span-1 text-center">Ekip</div>
                {activeTab === "upcoming" ? <div className="col-span-2 text-center">Geri Sayım</div> : null}
                <div className={cn("text-center", activeTab === "upcoming" ? "col-span-1" : "col-span-3")}>İşlem</div>
              </div>
              <ul className="divide-y divide-slate-700/50">
                {rows.map((event) => (
                  <BoardRow
                    key={event.id}
                    event={event}
                    tab={activeTab}
                    now={now}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardRow({
  event,
  tab,
  now,
  canEdit,
  canDelete,
}: {
  event: BoardEvent;
  tab: BoardTab;
  now: Date;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const type = eventTypeBadge(event.eventType);
  const countdown = countdownLabel(event.startsAt, now);
  const venueReady = hasVenue(event);
  const teamReady = hasTeam(event);
  return (
    <li className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-800/50">
      <div className="col-span-2">
        <div className="text-sm font-medium text-white">{dateFormat.format(event.startsAt)}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3 w-3" aria-hidden />
          {timeFormat.format(event.startsAt)}
        </div>
      </div>
      <div className="col-span-3">
        <Link href={`/events/${event.id}`} className="font-medium text-white transition-colors hover:text-blue-400">
          {event.name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">{event.reservationCount} rezervasyon</p>
      </div>
      <div className="col-span-2 flex justify-center">
        <Badge variant="outline" className={type.color}>
          {type.label}
        </Badge>
      </div>
      <div className="col-span-1 flex justify-center">
        <Link href={`/events/${event.id}/venue`} aria-label={`${event.name} alan düzeni: ${venueReady ? "hazır" : "düzenle"}`}>
          <Badge className={venueReady ? READY : PENDING}>
            {venueReady ? <CheckCircle2 aria-hidden /> : <MapPin aria-hidden />}
            {venueReady ? "Hazır" : "Düzenle"}
          </Badge>
        </Link>
      </div>
      <div className="col-span-1 flex justify-center">
        <Link
          href={`/events/${event.id}/team-organization`}
          aria-label={`${event.name} ekip organizasyonu: ${teamReady ? "hazır" : "ata"}`}
        >
          <Badge className={teamReady ? READY : PENDING}>
            {teamReady ? <CheckCircle2 aria-hidden /> : <Users aria-hidden />}
            {teamReady ? "Hazır" : "Ata"}
          </Badge>
        </Link>
      </div>
      {tab === "upcoming" ? (
        <div className="col-span-2 flex justify-center">
          {countdown ? (
            <Badge className="gap-1 border-blue-500/30 bg-blue-500/20 text-blue-400">
              <Timer aria-hidden />
              {countdown}
            </Badge>
          ) : (
            <Badge className="border-green-500/30 bg-green-500/20 text-green-400">Başladı</Badge>
          )}
        </div>
      ) : null}
      <div className={tab === "upcoming" ? "col-span-1" : "col-span-3"}>
        <EventRowActions
          event={{
            id: event.id,
            name: event.name,
            description: event.description,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
            eventType: event.eventType,
            reservationEnabled: event.reservationEnabled,
          }}
          canEdit={canEdit}
          canDelete={canDelete}
          deletable={event.status === "draft" && event.reservationCount === 0}
          editable={event.status !== "completed" && event.status !== "cancelled"}
        />
      </div>
    </li>
  );
}
