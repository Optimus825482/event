import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RESERVATION_STATUSES } from "@/domain/reservation-status";
import { can } from "@/features/auth/policy";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { MarkNoShowsButton } from "@/features/reservations/components/mark-no-shows-button";
import { ReservationStatusActions } from "@/features/reservations/components/status-actions";
import { RESERVATION_STATUS_LABELS } from "@/features/reservations/labels";
import { loadReservationList } from "@/features/reservations/queries";

export const metadata: Metadata = { title: "Etkinlik rezervasyonları | EventFlow" };

type Params = Promise<{ eventId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function EventReservationsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  const q = first(sp.q);
  const status = first(sp.status);
  const data = await loadReservationList(eventId, { q, status, page: first(sp.page) });
  const { actor, event, items, total, page, pageSize, statusCounts } = data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = can(actor, "reservations", "edit");
  const bookable = (event.status === "published" || event.status === "active") && event.reservationEnabled;

  const pageHref = (target: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    p.set("page", String(target));
    return `/reservations/${eventId}?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Link href="/reservations" className="text-sm text-muted-foreground hover:underline">
          Rezervasyonlar
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="text-sm text-muted-foreground">
              {dateFormat.format(event.startsAt)} · {EVENT_STATUS_LABELS[event.status]}
              {event.reservationEnabled ? "" : " · Rezervasyona kapalı"}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {canEdit && event.status === "completed" ? (
              <MarkNoShowsButton eventId={event.id} candidates={statusCounts.pending + statusCounts.confirmed} />
            ) : null}
            {can(actor, "reservations", "create") ? (
              <Link href={`/import/reservations/${eventId}`} className={buttonVariants({ variant: "outline" })}>
                Excel&apos;den içe aktar
              </Link>
            ) : null}
            {bookable && can(actor, "reservations", "create") ? (
              <Link href={`/reservations/${eventId}/new`} className={buttonVariants()}>
                Yeni rezervasyon
              </Link>
            ) : null}
          </div>
        </div>
        <dl className="flex flex-wrap gap-4 text-sm">
          {RESERVATION_STATUSES.map((s) => (
            <div key={s} className="flex gap-1">
              <dt className="text-muted-foreground">{RESERVATION_STATUS_LABELS[s]}:</dt>
              <dd className="font-medium">{statusCounts[s]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <form className="flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Ad, telefon veya masa"
          aria-label="Rezervasyon ara"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Durum"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tüm durumlar</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Süz
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {q || status ? "Aramaya uyan rezervasyon yok." : "Bu etkinlikte henüz rezervasyon yok."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Misafir</th>
                <th className="p-3 font-medium">Masa</th>
                <th className="p-3 font-medium">Kişi</th>
                <th className="p-3 font-medium">Durum</th>
                <th className="p-3 font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">
                    <Link href={`/reservations/${eventId}/${r.id}`} className="font-medium hover:underline">
                      {r.guestName ?? r.customerName ?? "Misafir"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.guestPhone ?? ""}
                      {r.isBlacklisted ? <span className="ml-2 text-destructive">Kara listede</span> : null}
                    </div>
                  </td>
                  <td className="p-3">{r.tableLabel}</td>
                  <td className="p-3">
                    {r.guestCount} / {r.tableCapacity}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full border border-border px-2 py-0.5">{RESERVATION_STATUS_LABELS[r.status]}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <Link
                        href={`/reservations/${eventId}/${r.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        QR / Ayrıntı
                      </Link>
                      <ReservationStatusActions
                        id={r.id}
                        status={r.status}
                        canEdit={canEdit}
                        canOverrideBlacklist={actor.role === "admin"}
                        isBlacklisted={r.isBlacklisted}
                        compact
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Sayfalar">
          {page > 1 ? <Link href={pageHref(page - 1)}>Önceki</Link> : <span />}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages ? <Link href={pageHref(page + 1)}>Sonraki</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
