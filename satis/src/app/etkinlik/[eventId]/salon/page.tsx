import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { saleModeNote } from "@/components/event/facts";
import { TICKET_DIALOG_HASH } from "@/components/event/ticket-dialog-shared";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EventSales } from "@/features/plan/event-sales";
import { parsePartySize } from "@/features/plan/party";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";
import { eventMetadataTitle, loadAvailability, loadEvent } from "../event-data";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ kisi?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  const meta = await eventMetadataTitle(eventId);
  return meta ? { ...meta, title: `${meta.title} · Masa Seçimi` } : {};
}

/**
 * Salon (3B/2B masa seçimi) sayfası. Satış açıkken yalnızca geçerli `kisi` ile gelinir; yoksa ya da geçersizse
 * etkinlik detayına kişi sayısı penceresi açık (`#bilet-al`) döner. Satış kapalıyken salon ve sahne görüşleri gezilir.
 */
export default async function SalonPage({ params, searchParams }: PageProps) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);

  const loaded = await loadEvent(eventId);
  if (!loaded.ok) {
    return (
      <main className="page-gutter mx-auto max-w-[1400px] py-10">
        <Notice tone="error">{loaded.message}</Notice>
      </main>
    );
  }
  const event = loaded.event;
  if (!event) notFound();

  const partySize = parsePartySize(sp.kisi, event.sale.maxSeatsPerOrder);
  if (event.sale.state === "open" && partySize === undefined) redirect(`/etkinlik/${event.id}${TICKET_DIALOG_HASH}`);

  const availability = await loadAvailability(eventId);

  return (
    <main className="page-gutter mx-auto max-w-[1400px] space-y-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm">
          <h1 className="font-sans text-sm font-semibold text-ivory">{event.name}</h1>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="text-gold">{`${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt)}`}</span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="text-xs text-muted">{saleModeNote(event.sale.mode)}</span>
        </div>
        <ButtonLink
          href={`/etkinlik/${event.id}`}
          variant="ghost"
          className="min-h-9 border border-line px-4 py-1.5 text-sm font-semibold"
        >
          ← Etkinlik detayı
        </ButtonLink>
      </header>

      <section id="masa-secimi" aria-labelledby="masa-secimi-baslik" className="space-y-4">
        <h2 id="masa-secimi-baslik" className="sr-only">
          Masa Seçimi
        </h2>
        {availability ? (
          <EventSales event={event} initialAvailability={availability} initialPartySize={partySize} />
        ) : (
          <Notice tone="error">Canlı masa durumu alınamadı. Sayfayı yenileyin.</Notice>
        )}
      </section>
    </main>
  );
}
