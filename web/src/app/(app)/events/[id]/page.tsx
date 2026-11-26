import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { eventTypeBadge } from "@/features/events/board";
import { ArtistLine, CountdownBanner, EventSummaryCards } from "@/features/events/components/event-detail-parts";
import { EventActions } from "@/features/events/components/event-actions";
import { EventForm } from "@/features/events/components/event-form";
import { ReviewToggles } from "@/features/events/components/review-toggles";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { loadEventDetail } from "@/features/events/queries";
import { PlanningStagePanel } from "@/features/planning/components/stage-panel";
import { loadPlanningPanel } from "@/features/planning/queries";
import { PlanPreviewCard } from "@/features/venue/components/plan-preview-card";
import { loadEventPlanPreview } from "@/features/venue/queries";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Etkinlik | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const statCard = "rounded-xl border border-slate-700 bg-slate-800/50 p-4";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, { event, tables }, preview, planning] = await Promise.all([
    requirePolicyActor(),
    loadEventDetail(id),
    loadEventPlanPreview(id),
    loadPlanningPanel(id),
  ]);
  const now = new Date();
  const canEdit = can(actor, "events", "edit");
  const closed = event.status === "completed" || event.status === "cancelled";
  const editable = canEdit && !closed;
  const venueEditable = can(actor, "venues", "edit") && !closed;
  const type = eventTypeBadge(event.eventType);

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="space-y-2">
          <Link href="/events" className="text-sm text-slate-400 hover:text-white hover:underline">
            Etkinlikler
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-white sm:text-2xl">{event.name}</h1>
            <div className="flex items-center gap-2">
              {event.eventType ? (
                <span className={`rounded-full border px-3 py-1 text-sm ${type.color}`}>{type.label}</span>
              ) : null}
              <span className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-200">
                {EVENT_STATUS_LABELS[event.status]}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            {dateFormat.format(event.startsAt)}
            {event.endsAt ? ` – ${dateFormat.format(event.endsAt)}` : ""}
          </p>
          <ArtistLine artistName={event.artistName} />
          {event.description ? <p className="max-w-3xl text-sm text-slate-300">{event.description}</p> : null}
          <EventActions
            id={event.id}
            status={event.status}
            canEdit={canEdit}
            canDelete={can(actor, "events", "delete")}
            deletable={event.status === "draft" && event.reservationCount === 0}
          />
        </div>

        {planning ? <PlanningStagePanel state={planning} /> : null}

        <CountdownBanner startsAt={event.startsAt} endsAt={event.endsAt} closed={closed} now={now} />

        <EventSummaryCards
          eventId={event.id}
          tableCount={event.tableCount}
          capacity={event.capacity}
          assignmentCount={event.assignmentCount}
          reservationCount={event.reservationCount}
        />

        <dl className="grid gap-4 sm:grid-cols-3">
          <div className={statCard}>
            <dt className="text-sm text-slate-400">Toplam kapasite</dt>
            <dd className="text-2xl font-bold text-white">{event.capacity}</dd>
          </div>
          <div className={statCard}>
            <dt className="text-sm text-slate-400">Masa</dt>
            <dd className="text-2xl font-bold text-white">{event.tableCount}</dd>
          </div>
          <div className={statCard}>
            <dt className="text-sm text-slate-400">Rezervasyon</dt>
            <dd className="text-2xl font-bold text-white">{event.reservationCount}</dd>
          </div>
        </dl>

        {preview ? <PlanPreviewCard eventId={event.id} plan={preview} canEdit={venueEditable} /> : null}

        <ReviewToggles
          id={event.id}
          reviewEnabled={event.reviewEnabled}
          reviewHistoryVisible={event.reviewHistoryVisible}
          canEdit={canEdit}
        />

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Masalar</h2>
          {tables.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
              Bu etkinlik için henüz masa yok.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tables.map((table) => (
                <li key={table.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
                  <span className="font-medium text-white">{table.label}</span>
                  <span className="ml-2 text-slate-400">{table.capacity} kişilik</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {editable ? (
          <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <h2 className="text-lg font-medium text-white">Etkinliği düzenle</h2>
            <div className="max-w-2xl">
              <EventForm
                idPrefix="detail-"
                event={{
                  id: event.id,
                  name: event.name,
                  description: event.description,
                  startsAt: event.startsAt.toISOString(),
                  endsAt: event.endsAt ? event.endsAt.toISOString() : null,
                  eventType: event.eventType,
                  artistName: event.artistName,
                  reservationEnabled: event.reservationEnabled,
                }}
              />
            </div>
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}
