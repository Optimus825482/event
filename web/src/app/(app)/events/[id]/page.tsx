import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { EventActions } from "@/features/events/components/event-actions";
import { EventForm } from "@/features/events/components/event-form";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { loadEventDetail } from "@/features/events/queries";

export const metadata: Metadata = { title: "Etkinlik | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, { event, tables }] = await Promise.all([requirePolicyActor(), loadEventDetail(id)]);
  const canEdit = can(actor, "events", "edit");
  const editable = canEdit && event.status !== "completed" && event.status !== "cancelled";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <Link href="/events" className="text-sm text-muted-foreground hover:underline">
          Etkinlikler
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <span className="rounded-full border border-border px-3 py-1 text-sm">
            {EVENT_STATUS_LABELS[event.status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {dateFormat.format(event.startsAt)}
          {event.endsAt ? ` – ${dateFormat.format(event.endsAt)}` : ""}
        </p>
        <EventActions
          id={event.id}
          status={event.status}
          canEdit={canEdit}
          canDelete={can(actor, "events", "delete")}
          deletable={event.status === "draft" && event.reservationCount === 0}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border p-4">
          <dt className="text-sm text-muted-foreground">Toplam kapasite</dt>
          <dd className="text-2xl font-semibold">{event.capacity}</dd>
        </div>
        <div className="rounded-md border border-border p-4">
          <dt className="text-sm text-muted-foreground">Masa</dt>
          <dd className="text-2xl font-semibold">{event.tableCount}</dd>
        </div>
        <div className="rounded-md border border-border p-4">
          <dt className="text-sm text-muted-foreground">Rezervasyon</dt>
          <dd className="text-2xl font-semibold">{event.reservationCount}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Masalar</h2>
        {tables.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Bu etkinlik için henüz masa yok.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tables.map((table) => (
              <li key={table.id} className="rounded-md border border-border p-3 text-sm">
                <span className="font-medium">{table.label}</span>
                <span className="ml-2 text-muted-foreground">{table.capacity} kişilik</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Etkinliği düzenle</h2>
          <EventForm
            event={{
              id: event.id,
              name: event.name,
              description: event.description,
              startsAt: event.startsAt.toISOString(),
              endsAt: event.endsAt ? event.endsAt.toISOString() : null,
              eventType: event.eventType,
              reservationEnabled: event.reservationEnabled,
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
