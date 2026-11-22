import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { loadReservationEvents } from "@/features/reservations/queries";

export const metadata: Metadata = { title: "Rezervasyonlar | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function pageHref(page: number, search?: string): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  return `/reservations?${params.toString()}`;
}

export default async function ReservationEventsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const search = first(sp.search);
  const list = await loadReservationEvents({ search, page: first(sp.page) });
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Rezervasyonlar</h1>
        <p className="text-sm text-muted-foreground">Rezervasyonlarını yönetmek için bir etkinlik seçin.</p>
      </div>

      <form className="flex flex-wrap gap-2" role="search">
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Etkinlik ara"
          aria-label="Etkinlik ara"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Ara
        </button>
      </form>

      {list.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Etkinlik bulunamadı.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {list.items.map((event) => (
            <li key={event.id}>
              <Link
                href={`/reservations/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted-foreground">{dateFormat.format(event.startsAt)}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{event.reservationCount} rezervasyon</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{EVENT_STATUS_LABELS[event.status]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Sayfalar">
          {list.page > 1 ? <Link href={pageHref(list.page - 1, search)}>Önceki</Link> : <span />}
          <span>
            {list.page} / {totalPages}
          </span>
          {list.page < totalPages ? <Link href={pageHref(list.page + 1, search)}>Sonraki</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
