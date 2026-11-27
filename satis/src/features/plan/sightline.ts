import type { SightlineSet } from "@/lib/core/contract";

export const SIGHTLINE_LABEL = /^[A-Z]-[0-9]{1,3}[A-Z]?$/;
export const SIGHTLINE_CAPTION = "Temsili görünüm · krokiye göre yaklaşık açı";

export function sightlineSrc(set: SightlineSet | null, label: string | null): string | null {
  if (!set) return null;
  if (label === null) return `/sightline/${set}/overview.webp`;
  if (!SIGHTLINE_LABEL.test(label)) return null;
  return `/sightline/${set}/${label}.webp`;
}
