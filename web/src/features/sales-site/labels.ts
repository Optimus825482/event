import type { SaleState, SightlineSet } from "@/features/sales-api/contract";

const SITE_STATE_LABELS: Record<SaleState, string> = {
  open: "Satışta",
  not_started: "Satış başlamadı",
  ended: "Satış sona erdi",
  closed: "Satış kapalı",
};

export function siteStateLabel(state: SaleState | null): string {
  return state ? SITE_STATE_LABELS[state] : "Sitede değil";
}

export const SIGHTLINE_SET_LABELS: Record<SightlineSet, string> = {
  diamond: "Merit Royal Diamond",
};
