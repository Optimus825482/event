import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/features/auth/policy";
import { ReservationForm } from "@/features/reservations/components/reservation-form";
import { loadNewReservationPage } from "@/features/reservations/queries";

export const metadata: Metadata = { title: "Yeni rezervasyon | EventFlow" };

type Params = Promise<{ eventId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function NewReservationPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  const customerQ = first(sp.customerQ);
  const { actor, event, tables, plan, statuses, customerResults } = await loadNewReservationPage(eventId, customerQ);
  const bookable = (event.status === "published" || event.status === "active") && event.reservationEnabled;
  const freeCount = tables.filter((t) => t.available).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href={`/reservations/${eventId}`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <h1 className="text-2xl font-semibold">Yeni rezervasyon</h1>
        <p className="text-sm text-muted-foreground">
          {freeCount} / {tables.length} masa boş
        </p>
      </div>

      {!can(actor, "reservations", "create") ? (
        <p role="alert" className="text-sm text-destructive">
          Rezervasyon oluşturma yetkiniz yok.
        </p>
      ) : !bookable ? (
        <p role="alert" className="rounded-md border border-border p-4 text-sm">
          Bu etkinlik şu anda rezervasyona açık değil (yalnızca yayında veya devam eden ve rezervasyonu açık etkinlikler).
        </p>
      ) : (
        <>
          {can(actor, "customers", "view") ? (
            <form className="flex flex-wrap gap-2" role="search">
              <input
                name="customerQ"
                defaultValue={customerQ ?? ""}
                placeholder="Kayıtlı müşteri ara (ad, telefon, e-posta)"
                aria-label="Müşteri ara"
                className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Müşteri ara
              </button>
            </form>
          ) : null}
          {customerQ && customerResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Müşteri bulunamadı; misafir bilgisini girin, telefon/e-postaya göre müşteri kaydı otomatik oluşturulur.
            </p>
          ) : null}
          <ReservationForm
            eventId={eventId}
            tables={tables}
            plan={plan}
            tableStatuses={statuses}
            customers={customerResults.map((c) => ({
              id: c.id,
              fullName: c.fullName,
              phone: c.phone,
              email: c.email,
              isBlacklisted: c.isBlacklisted,
            }))}
            canOverrideBlacklist={actor.role === "admin"}
          />
        </>
      )}
    </div>
  );
}
