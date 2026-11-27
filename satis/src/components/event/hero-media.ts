import type { EventDetail } from "@/lib/core/contract";
import { heroMediaUrl, imageUrl } from "@/lib/image-url";

export type EventHeroMedia = { src: string | null; stillSrc: string | null };

type HeroInput = Pick<EventDetail, "coverImage" | "artistImage"> & { site: Pick<EventDetail["site"], "heroImage"> };

/**
 * Etkinlik sayfası üst görseli: tanıtım görseli (`site.heroImage`, hareketli WebP ya da WebM video olabilir) gösterilir;
 * azaltılmış hareket tercihinde yerine sabit kapak (yoksa sanatçı görseli) kullanılır; video için poster de odur.
 * Tanıtım görseli yoksa sabit görsel tek başına gösterilir.
 */
export function eventHeroMedia(event: HeroInput): EventHeroMedia {
  const motion = heroMediaUrl(event.site.heroImage);
  const still = imageUrl(event.coverImage) ?? imageUrl(event.artistImage);
  if (motion) return { src: motion, stillSrc: still };
  return { src: still, stillSrc: null };
}
