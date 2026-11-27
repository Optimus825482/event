import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saleModeNote } from "@/components/event/facts";
import { TICKET_DIALOG_HASH } from "@/components/event/ticket-dialog-shared";
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
      <main className="page-gutter mx-auto max-w-[1320px] py-10">
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
    <main className="page-gutter mx-auto max-w-[1320px] space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">{`${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt)}`}</p>
          <h1 className="text-[clamp(28px,4vw,44px)] text-ivory">{event.name}</h1>
          <p className="text-sm text-muted">{saleModeNote(event.sale.mode)}</p>
        </div>
        <Link
          href={`/etkinlik/${event.id}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-gold no-underline hover:text-gold-bright"
        >
          ← Etkinlik detayı
        </Link>
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
