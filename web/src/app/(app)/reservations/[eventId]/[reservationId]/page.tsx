import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { can } from "@/features/auth/policy";
import { ReservationEditForm } from "@/features/reservations/components/reservation-edit-form";
import { ReservationStatusActions } from "@/features/reservations/components/status-actions";
import { RESERVATION_STATUS_LABELS } from "@/features/reservations/labels";
import { loadReservationDetail } from "@/features/reservations/queries";

export const metadata: Metadata = { title: "Rezervasyon | EventFlow", referrer: "no-referrer" };

type Params = Promise<{ eventId: string; reservationId: string }>;

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function ReservationDetailPage({ params }: { params: Params }) {
  const { eventId, reservationId } = await params;
  const { actor, reservation, tableLabel, tableCapacity, customer, isBlacklisted, event, tables } = await loadReservationDetail(
    eventId,
    reservationId,
  );
  // QR içeriği yalnızca imzalı belirteçtir (davetiyedeki QR ile aynı); masa bilgisi taşımaz.
  const qrSrc = await QRCode.toDataURL(reservation.qrToken, { width: 280, margin: 1 });
  const canEdit = can(actor, "reservations", "edit");
  const editable =
    canEdit &&
    event.status !== "completed" &&
    event.status !== "cancelled" &&
    (reservation.status === "pending" || reservation.status === "confirmed" || reservation.status === "checked_in");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link href={`/reservations/${eventId}`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{reservation.guestName ?? customer?.fullName ?? "Misafir"}</h1>
          <span className="rounded-full border border-border px-3 py-1 text-sm">
            {RESERVATION_STATUS_LABELS[reservation.status]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Masa</dt>
          <dd>
            {tableLabel} ({tableCapacity} kişilik)
          </dd>
          <dt className="text-muted-foreground">Kişi sayısı</dt>
          <dd>{reservation.guestCount}</dd>
          {customer ? (
            <>
              <dt className="text-muted-foreground">Müşteri</dt>
              <dd>
                <Link href={`/customers/${customer.id}`} className="hover:underline">
                  {customer.fullName}
                </Link>
                {customer.isBlacklisted ? <span className="ml-2 text-destructive">Kara listede</span> : null}
                <span className="ml-2 text-muted-foreground">
                  {customer.totalReservations} rezervasyon, {customer.noShowCount} gelmedi
                </span>
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Telefon</dt>
          <dd>{reservation.guestPhone ?? customer?.phone ?? "-"}</dd>
          <dt className="text-muted-foreground">E-posta</dt>
          <dd>{reservation.guestEmail ?? customer?.email ?? "-"}</dd>
          <dt className="text-muted-foreground">Özel istek</dt>
          <dd className="whitespace-pre-wrap">{reservation.specialRequests ?? "-"}</dd>
          <dt className="text-muted-foreground">Oluşturulma</dt>
          <dd>{dateFormat.format(reservation.createdAt)}</dd>
          {reservation.checkedInAt ? (
            <>
              <dt className="text-muted-foreground">Giriş</dt>
              <dd>{dateFormat.format(reservation.checkedInAt)}</dd>
            </>
          ) : null}
        </dl>
        <figure className="space-y-2 text-center">
          <Image
            src={qrSrc}
            alt="Giriş QR kodu"
            width={200}
            height={200}
            unoptimized
            className="mx-auto rounded-md border border-border bg-white p-2"
          />
          <figcaption className="text-xs text-muted-foreground">Girişte okutulacak QR</figcaption>
        </figure>
      </div>

      <ReservationStatusActions
        id={reservation.id}
        status={reservation.status}
        canEdit={canEdit && event.status !== "completed"}
        canOverrideBlacklist={actor.role === "admin"}
        isBlacklisted={isBlacklisted}
      />

      {editable ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Düzenle</h2>
          <ReservationEditForm
            reservation={{
              id: reservation.id,
              tableId: reservation.tableId,
              guestCount: reservation.guestCount,
              guestName: reservation.guestName,
              guestPhone: reservation.guestPhone,
              guestEmail: reservation.guestEmail,
              specialRequests: reservation.specialRequests,
            }}
            tables={tables}
          />
        </section>
      ) : null}
    </div>
  );
}
