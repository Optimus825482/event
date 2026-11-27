import { HERO_VIDEO_PATH_PATTERN, IMAGE_PATH_PATTERN } from "@/features/sales-api/contract";

export const IMAGE_SLOTS = ["cover", "hero", "artist"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

export const IMAGE_SLOT_LABELS: Record<ImageSlot, string> = {
  cover: "Kapak",
  hero: "Hero",
  artist: "Sanatçı",
};

export type ImageStatus = { status: "complete" | "missing"; missing: ImageSlot[] };

/** Yalnızca sözleşme desenine uyan görsel yolunu kabul eder; aksi hâlde `null`. */
export function validImagePath(value: string | null): string | null {
  return value && IMAGE_PATH_PATTERN.test(value) ? value : null;
}

/** Hero alanı: görsel yolu ya da `event/<uuid>.webm` video yolu; aksi hâlde `null`. */
export function validHeroPath(value: string | null): string | null {
  return validImagePath(value) ?? (value && HERO_VIDEO_PATH_PATTERN.test(value) ? value : null);
}

/** Yol hero WebM videosu ise `true`. */
export function isHeroVideoPath(value: string | null): boolean {
  return value !== null && HERO_VIDEO_PATH_PATTERN.test(value);
}

/** Etkinliğin satış sitesi için gereken görsellerinin tamlık durumunu hesaplar. */
export function imageStatusOf(i: {
  coverImage: string | null;
  heroImage: string | null;
  artistId: string | null;
  artistImage: string | null;
}): ImageStatus {
  const missing: ImageSlot[] = [];
  if (!validImagePath(i.coverImage)) missing.push("cover");
  if (!validHeroPath(i.heroImage)) missing.push("hero");
  if (i.artistId !== null && !validImagePath(i.artistImage)) missing.push("artist");
  return { status: missing.length === 0 ? "complete" : "missing", missing };
}
