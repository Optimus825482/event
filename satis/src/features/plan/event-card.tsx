import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { ButtonLink } from "@/components/ui/button";
import { saleStateLabel } from "@/features/plan/sale-state";
import { cn } from "@/lib/cn";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";

export function EventCard({
  event,
  headingLevel = 2,
}: {
  event: EventCardData;
  headingLevel?: 2 | 3;
}): React.JSX.Element {
  const open = event.saleState === "open";
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const src = imageUrl(event.coverImage ?? event.artistImage);
  const dateLabel = formatEventDate(event.startsAt);
  const timeLabel = formatEventTime(event.startsAt);

  return (
    <article className="group flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface-raised transition-all hover:-translate-y-0.5 hover:border-gold">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface">
        <EventImage
          src={src}
          alt={event.artistName ?? event.name}
          className="h-full w-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-[1.03]"
          fallback={<PosterFallback title={event.artistName ?? event.name} subtitle={dateLabel} className="h-full w-full" />}
        />
        <span className="pointer-events-none absolute top-3 left-3 rounded-full border border-line bg-bg/80 px-3 py-1 text-[11px] font-semibold text-gold-bright backdrop-blur-md">
          {dateLabel}
        </span>
        <span
          className={cn(
            "pointer-events-none absolute top-3 right-3 rounded-full border border-line bg-bg/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md",
            open ? "text-success" : "text-danger",
          )}
        >
          {saleStateLabel(event.saleState)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="text-xs font-semibold text-gold-bright">{`${dateLabel} · ${timeLabel}`}</p>
        <Heading className="text-[26px] text-ivory">{event.name}</Heading>
        {event.artistName ? <p className="text-sm text-muted">{event.artistName}</p> : null}
        {event.isDemo ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-gold px-2.5 py-0.5 text-xs font-semibold text-gold">DEMO</span>
          </div>
        ) : null}
        {event.minPrice !== null ? (
          <p className="text-sm text-ivory">{`Başlangıç: ${formatMoney(event.minPrice, event.currency)}`}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
          <ButtonLink href={`/etkinlik/${event.id}`} variant="glass">
            Detaylar
          </ButtonLink>
          {open ? (
            <ButtonLink href={`/etkinlik/${event.id}#bilet-al`} variant="gold">
              Bilet Al
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
