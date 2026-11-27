import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventFacts } from "@/components/event/event-facts";
import { eventFacts, saleModeNote } from "@/components/event/facts";
import { eventHeroMedia } from "@/components/event/hero-media";
import { PartyPicker } from "@/components/event/party-picker";
import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { Notice } from "@/components/ui/notice";
import { EventSales } from "@/features/plan/event-sales";
import { parsePartySize } from "@/features/plan/party";
import { getReader } from "@/features/plan/read";
import { saleStateLabel } from "@/features/plan/sale-state";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ kisi?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await getReader().event(eventId);
    return event ? { title: event.name, description: event.site.summary ?? undefined } : {};
  } catch {
    return {};
  }
}

async function loadAvailability(eventId: string): Promise<Availability | null> {
  try {
    return await getReader().availability(eventId);
  } catch (error) {
    if (error instanceof CoreError) return null;
    throw error;
  }
}

export default async function EventPage({ params, searchParams }: PageProps) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);

  let event: EventDetail | null;
  try {
    event = await getReader().event(eventId);
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    return (
      <main className="page-gutter mx-auto max-w-[1180px] py-10">
        <Notice tone="error">{messageFor(error)}</Notice>
      </main>
    );
  }
  if (!event) notFound();

  const availability = await loadAvailability(eventId);
  const partySize = parsePartySize(sp.kisi, event.sale.maxSeatsPerOrder);
  const hero = eventHeroMedia(event);
  const dateLabel = formatEventDate(event.startsAt);
  const timeLabel = formatEventTime(event.startsAt);
  const summary = event.site.summary ?? event.description;

  return (
    <main className="page-gutter mx-auto max-w-[1180px] space-y-10 py-10">
      <div className="grid grid-cols-1 items-start gap-8 min-[860px]:grid-cols-[0.9fr_1.1fr]">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-[20px] border border-line-gold bg-surface">
          <EventImage
            src={hero.src}
            stillSrc={hero.stillSrc}
            alt={event.artistName ?? event.name}
            priority
            className="h-full w-full object-cover object-[center_15%]"
            fallback={
              <PosterFallback
                title={event.artistName ?? event.name}
                subtitle={dateLabel}
                className="h-full w-full"
              />
            }
          />
        </div>

        <div className="space-y-5">
          <p className="eyebrow">{`${dateLabel} · ${timeLabel}`}</p>
          <div className="space-y-2">
            <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">{event.name}</h1>
            {event.artistName ? <p className="text-lg text-muted">{event.artistName}</p> : null}
          </div>

          {event.isDemo ? (
            <span className="inline-block rounded-full border border-gold px-3 py-0.5 text-xs font-semibold text-gold">
              DEMO
            </span>
          ) : null}

          <EventFacts facts={eventFacts(event)} />

          {summary ? <p className="text-base leading-relaxed text-ivory">{summary}</p> : null}

          {event.sale.state === "open" ? (
            <PartyPicker eventId={event.id} maxSeatsPerOrder={event.sale.maxSeatsPerOrder} selected={partySize} />
          ) : (
            <Notice>{saleStateLabel(event.sale.state)}</Notice>
          )}
        </div>
      </div>

      <section id="masa-secimi" aria-labelledby="masa-secimi-baslik" className="scroll-mt-24 space-y-4">
        <h2 id="masa-secimi-baslik" className="text-[clamp(30px,4vw,44px)] text-ivory">
          Masa Seçimi
        </h2>
        <p className="text-sm text-muted">{saleModeNote(event.sale.mode)}</p>
        {availability ? (
          <EventSales event={event} initialAvailability={availability} initialPartySize={partySize} />
        ) : (
          <Notice tone="error">Canlı masa durumu alınamadı. Sayfayı yenileyin.</Notice>
        )}
      </section>
    </main>
  );
}
