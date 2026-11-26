import { ButtonLink } from "@/components/ui/button";
import { saleStateLabel } from "@/features/plan/sale-state";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { formatEventWhen } from "@/lib/time-zone";

export function EventCard({ event }: { event: EventCardData }) {
  const open = event.saleState === "open";
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-xl font-semibold text-ivory">{event.name}</h2>
        <span className="rounded-full border border-gold px-3 py-1 text-sm text-gold">
          {saleStateLabel(event.saleState)}
        </span>
      </div>
      <p className="text-ivory">{formatEventWhen(event.startsAt)}</p>
      {event.artistName ? <p className="text-muted">{event.artistName}</p> : null}
      {event.minPrice !== null ? (
        <p className="text-muted">{`Başlangıç fiyatı: ${formatMoney(event.minPrice, event.currency)}`}</p>
      ) : null}
      <ButtonLink href={`/etkinlik/${event.id}`} variant={open ? "gold" : "glass"} className="self-start">
        {open ? "Masa seç" : "İncele"}
      </ButtonLink>
    </article>
  );
}
