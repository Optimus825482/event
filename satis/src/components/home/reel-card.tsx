import Link from "next/link";
import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { ButtonLink } from "@/components/ui/button";
import { saleStateLabel } from "@/features/plan/sale-state";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { heroMediaUrl, imageUrl } from "@/lib/image-url";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";

export function ReelCard({ event }: { event: EventCardData }): React.JSX.Element {
  const open = event.saleState === "open";
  const src = imageUrl(event.artistImage ?? event.coverImage);
  const motion = heroMediaUrl(event.heroImage);
  const dateLabel = formatEventDate(event.startsAt);
  const timeLabel = formatEventTime(event.startsAt);

  return (
    <article className="group relative aspect-[9/14] overflow-hidden rounded-[16px] border border-line bg-bg transition-all hover:-translate-y-[3px] hover:border-gold">
      <EventImage
        src={motion ?? src}
        stillSrc={motion ? src : null}
        alt={event.artistName ?? event.name}
        className="h-full w-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-[1.03]"
        fallback={
          <PosterFallback
            title={event.artistName ?? event.name}
            subtitle={dateLabel}
            className="h-full w-full"
          />
        }
      />

      {event.isDemo ? (
        <span className="pointer-events-none absolute top-3 left-3 rounded-full border border-gold bg-bg/80 px-2.5 py-0.5 text-[11px] font-semibold text-gold backdrop-blur-md">
          DEMO
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-bg via-bg/90 to-transparent p-4 pt-16">
        <p className="text-[11.5px] font-medium text-gold-bright">{`${dateLabel} · ${timeLabel}`}</p>
        <h3 className="font-serif text-[22px] leading-[1.1] font-bold text-ivory">
          <Link href={`/etkinlik/${event.id}`} className="no-underline hover:text-gold-bright">
            {event.artistName ?? event.name}
          </Link>
        </h3>
        {!open ? (
          <p className="text-xs font-medium text-danger">{saleStateLabel(event.saleState)}</p>
        ) : null}
        <div className="pt-2">
          {open ? (
            <ButtonLink href={`/etkinlik/${event.id}#bilet-al`} variant="gold" className="min-h-8 w-full px-3.5 py-1.5 text-xs">
              Bilet Al
            </ButtonLink>
          ) : (
            <ButtonLink href={`/etkinlik/${event.id}`} variant="glass" className="min-h-8 w-full px-3.5 py-1.5 text-xs">
              Detaylar
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}
