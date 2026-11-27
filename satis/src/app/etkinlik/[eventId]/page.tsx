import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { EventFacts } from "@/components/event/event-facts";
import { eventFacts } from "@/components/event/facts";
import { eventHeroMedia } from "@/components/event/hero-media";
import { salonPath, TicketDialog, ticketDialogNoscriptCss } from "@/components/event/ticket-dialog";
import { eventVenue, VenueMap } from "@/components/event/venue-map";
import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PARTY_PARAM, parsePartySize } from "@/features/plan/party";
import { saleStateLabel } from "@/features/plan/sale-state";
import { formatEventDate, formatEventDay, formatEventTime } from "@/lib/time-zone";
import { eventMetadataTitle, loadEvent } from "./event-data";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ kisi?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  return (await eventMetadataTitle(eventId)) ?? {};
}

export default async function EventPage({ params, searchParams }: PageProps) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);

  const loaded = await loadEvent(eventId);
  if (!loaded.ok) {
    return (
      <main className="page-gutter mx-auto max-w-[1180px] py-10">
        <Notice tone="error">{loaded.message}</Notice>
      </main>
    );
  }
  const event = loaded.event;
  if (!event) notFound();

  // Eski `/etkinlik/<id>?kisi=n#masa-secimi` bağlantıları salon sayfasına taşınır.
  const partySize = parsePartySize(sp.kisi, event.sale.maxSeatsPerOrder);
  if (partySize !== undefined) redirect(`${salonPath(event.id)}?${PARTY_PARAM}=${partySize}`);

  const nonce = (await headers()).get("x-nonce");
  const hero = eventHeroMedia(event);
  const dateLabel = formatEventDate(event.startsAt);
  const timeLabel = formatEventTime(event.startsAt);
  const summary = event.site.summary ?? event.description;
  const saleOpen = event.sale.state === "open";

  return (
    <main className="page-gutter mx-auto max-w-[1180px] space-y-12 py-10">
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

          <EventFacts
            facts={eventFacts(event)}
            action={
              saleOpen ? (
                <TicketDialog
                  eventId={event.id}
                  eyebrow={`${event.artistName ?? event.name} · ${formatEventDay(event.startsAt)}`.toLocaleUpperCase("tr-TR")}
                  maxSeatsPerOrder={event.sale.maxSeatsPerOrder}
                />
              ) : (
                <Notice className="flex w-full items-center">{saleStateLabel(event.sale.state)}</Notice>
              )
            }
          />
          {saleOpen ? <noscript dangerouslySetInnerHTML={{ __html: ticketDialogNoscriptCss(nonce) }} /> : null}

          {summary ? <p className="text-base leading-relaxed text-ivory">{summary}</p> : null}

          {saleOpen ? null : (
            <ButtonLink href={salonPath(event.id)} variant="glass">
              Salonu ve sahne görüşünü incele →
            </ButtonLink>
          )}
        </div>
      </div>

      <VenueMap venue={eventVenue()} />
    </main>
  );
}
