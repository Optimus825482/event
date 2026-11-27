import type { EventCard as EventCardData } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";
import { saleStateLabel } from "@/features/plan/sale-state";

export const HERO_SLIDE_COUNT = 4;
export const HOME_CARD_COUNT = 6;
export const AUTO_ADVANCE_MS = 7000;

export type HeroSlide = {
  id: string;
  name: string;
  artistName: string | null;
  dateLabel: string;
  timeLabel: string;
  priceLabel: string | null;
  open: boolean;
  stateLabel: string;
  image: string | null;
  isDemo: boolean;
};

export function toHeroSlides(events: EventCardData[]): HeroSlide[] {
  return events.slice(0, HERO_SLIDE_COUNT).map((event) => ({
    id: event.id,
    name: event.name,
    artistName: event.artistName,
    dateLabel: formatEventDate(event.startsAt),
    timeLabel: formatEventTime(event.startsAt),
    priceLabel: event.minPrice !== null ? formatMoney(event.minPrice, event.currency) : null,
    open: event.saleState === "open",
    stateLabel: saleStateLabel(event.saleState),
    image: imageUrl(event.artistImage ?? event.coverImage),
    isDemo: event.isDemo,
  }));
}

export function nextIndex(current: number, count: number, step: 1 | -1): number {
  if (count <= 0) return 0;
  return (current + step + count) % count;
}

export function shouldAutoAdvance(i: {
  slideCount: number;
  reducedMotion: boolean;
  paused: boolean;
}): boolean {
  return i.slideCount > 1 && !i.reducedMotion && !i.paused;
}
