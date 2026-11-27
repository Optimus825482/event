import type { SightlineSet } from "@/lib/core/contract";

export const SIGHTLINE_LABEL = /^[A-Z]-[0-9]{1,3}[A-Z]?$/;
export const SIGHTLINE_CAPTION = "Temsili görünüm · krokiye göre yaklaşık açı";

export function sightlineSrc(set: SightlineSet | null, label: string | null): string | null {
  if (!set) return null;
  if (label === null) return `/sightline/${set}/overview.webp`;
  if (!SIGHTLINE_LABEL.test(label)) return null;
  return `/sightline/${set}/${label}.webp`;
}

/**
 * Masa/loca etiketini `M-12` / `L-3A` biçimine normalleştirir;
 * geçerli bir sahne görüşü etiketine dönüştürülemiyorsa `null` döner.
 */
export function normalizeSightlineLabel(label: string, isLoca: boolean): string | null {
  const trimmed = label.trim();
  if (SIGHTLINE_LABEL.test(trimmed)) return trimmed;

  const stripped = trimmed.replace(/^(?:masa|loca)\s+/i, "").trim().toUpperCase();
  if (SIGHTLINE_LABEL.test(stripped)) return stripped;

  if (/^[0-9]{1,3}[A-Z]?$/.test(stripped)) {
    const candidate = `${isLoca ? "L" : "M"}-${stripped}`;
    return SIGHTLINE_LABEL.test(candidate) ? candidate : null;
  }

  return null;
}

/** Masa/loca nesnesinden sahne görüşü görsel yolunu çözer. */
export function resolveTableSightlineSrc(
  set: SightlineSet | null,
  table: { label: string; isLoca: boolean } | null,
): string | null {
  if (!set) return null;
  if (table === null) return `/sightline/${set}/overview.webp`;
  const normalized = normalizeSightlineLabel(table.label, table.isLoca);
  return normalized ? `/sightline/${set}/${normalized}.webp` : null;
}
