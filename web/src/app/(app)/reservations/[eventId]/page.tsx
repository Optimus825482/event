import { ArrowLeft, FileSpreadsheet, Plus, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/domain/reservation-status";
import { can } from "@/features/auth/policy";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { PlanningStagePanel } from "@/features/planning/components/stage-panel";
import { loadPlanningPanel } from "@/features/planning/queries";
import { InvitationDialog } from "@/features/reservations/components/invitation-dialog";
import { MarkNoShowsButton } from "@/features/reservations/components/mark-no-shows-button";
import { ReservationList } from "@/features/reservations/components/reservation-list";
import { ReservationMap } from "@/features/reservations/components/reservation-map";
import { RESERVATION_STATUS_LABELS } from "@/features/reservations/labels";
import { loadInvitationRecipients, loadReservationList, loadReservationMap } from "@/features/reservations/queries";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/features/auth/scope";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Etkinlik rezervasyonları | EventFlow",
};

type Params = Promise<{ eventId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const CHIP_TONES: Record<ReservationStatus, string> = {
  confirmed: "border-emerald-500/40 text-emerald-300",
  pending: "border-amber-500/40 text-amber-300",
  cancelled: "border-red-500/40 text-red-300",
  checked_in: "border-blue-500/40 text-blue-300",
  no_show: "border-slate-500/40 text-slate-300",
};

export default async function EventReservationsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  const q = first(sp.q);
  const status = first(sp.status);
  const mapView = first(sp.view) === "map";
  const data = await loadReservationList(eventId, { q, status, page: first(sp.page) });
  const mapData = mapView ? await loadReservationMap(eventId) : null;
  const { actor, event, items, total, page, pageSize, statusCounts } = data;
  const [recipients, planning] = await Promise.all([loadInvitationRecipients(actor, eventId), loadPlanningPanel(eventId)]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = can(actor, "reservations", "edit");
  const canCreate = can(actor, "reservations", "create");
  const bookable = (event.status === "published" || event.status === "active") && event.reservationEnabled;
  const activeStatus = RESERVATION_STATUSES.find((s) => s === status);

  const href = (override: { status?: string | undefined; page?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const nextStatus = "status" in override ? override.status : status;
    if (nextStatus) p.set("status", nextStatus);
    if (override.page) p.set("page", String(override.page));
    const qs = p.toString();
    return qs ? `/reservations/${eventId}?${qs}` : `/reservations/${eventId}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/reservations" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" />
        Rezervasyonlar
      </Link>
      <PageHeader
        className="mb-0"
        title={event.name}
        description={`${dateFormat.format(event.startsAt)} · ${EVENT_STATUS_LABELS[event.status]}${event.reservationEnabled ? "" : " · Rezervasyona kapalı"}`}
        icon={<Ticket className="size-8 text-purple-400" />}
        actions={
          <>
            {canEdit && event.status === "completed" ? (
              <MarkNoShowsButton eventId={event.id} candidates={statusCounts.pending + statusCounts.confirmed} />
            ) : null}
            {recipients ? <InvitationDialog recipients={recipients} canSend={can(actor, "invitations", "edit")} /> : null}
            {canCreate ? (
              <Link href={`/import/reservations/${eventId}`} className={buttonVariants({ variant: "outline" })}>
                <FileSpreadsheet />
                Excel&apos;den içe aktar
              </Link>
            ) : null}
            {bookable && canCreate ? (
              <Link
                href={`/reservations/${eventId}/new`}
                className={buttonVariants({
                  className: "bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500",
                })}
              >
                <Plus />
                Yeni rezervasyon
              </Link>
            ) : null}
          </>
        }
      />

      {planning ? <PlanningStagePanel state={planning} compact /> : null}

      {event.status === "active" ? (
        <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
          Etkinlik başladı!
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Görünüm" className="flex gap-2 text-sm">
          {[
            { view: "list", label: "Liste", href: `/reservations/${eventId}` },
            { view: "map", label: "Harita", href: `/reservations/${eventId}?view=map` },
          ].map((tab) => {
            const active = (tab.view === "map") === mapView;
            return (
              <Link
                key={tab.view}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={buttonVariants({
                  variant: active ? "default" : "outline",
                  size: "sm",
                  className: active ? "bg-purple-600 text-white hover:bg-purple-500" : undefined,
                })}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Durum sayıları">
          {RESERVATION_STATUSES.map((s) => (
            <li key={s}>
              <Link
                href={mapView ? `/reservations/${eventId}?view=map` : href({ status: activeStatus === s ? undefined : s })}
                aria-current={activeStatus === s ? "true" : undefined}
                className={cn(
                  "flex gap-1.5 rounded-full border bg-slate-800/50 px-3 py-1 transition-colors hover:bg-slate-800",
                  CHIP_TONES[s],
                  activeStatus === s && "bg-slate-700 ring-1 ring-current",
                )}
              >
                <span>{RESERVATION_STATUS_LABELS[s]}:</span>
                <span className="font-semibold">{statusCounts[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {mapData ? <ReservationMap eventId={eventId} data={mapData} /> : null}

      {mapData ? null : (
        <>
          <form className="flex flex-wrap gap-2" role="search">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ad, telefon veya masa"
              aria-label="Rezervasyon ara"
              className="h-10 min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Süz
            </button>
            {activeStatus ? (
              <Link href={href({ status: undefined })} className={buttonVariants({ variant: "ghost" })}>
                Süzgeci temizle
              </Link>
            ) : null}
          </form>

          {items.length === 0 ? (
            <EmptyState
              icon={<Ticket />}
              title={q || status ? "Aramaya uyan rezervasyon yok." : "Bu etkinlikte henüz rezervasyon yok."}
            />
          ) : (
            <ReservationList
              eventId={eventId}
              canEdit={canEdit}
              canOverrideBlacklist={isAdmin(actor)}
              items={items.map((r) => ({
                id: r.id,
                status: r.status,
                guestName: r.guestName,
                customerName: r.customerName,
                guestPhone: r.guestPhone,
                guestEmail: r.guestEmail,
                tableLabel: r.tableLabel,
                tableCapacity: r.tableCapacity,
                guestCount: r.guestCount,
                specialRequests: r.specialRequests,
                isBlacklisted: r.isBlacklisted,
              }))}
            />
          )}

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between text-sm" aria-label="Sayfalar">
              {page > 1 ? <Link href={href({ page: page - 1 })}>Önceki</Link> : <span />}
              <span>
                {page} / {totalPages}
              </span>
              {page < totalPages ? <Link href={href({ page: page + 1 })}>Sonraki</Link> : <span />}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
