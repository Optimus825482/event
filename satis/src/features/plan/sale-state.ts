import type { SaleState } from "@/lib/core/contract";

const LABELS: Record<SaleState, string> = {
  open: "Satışta",
  not_started: "Satış yakında",
  ended: "Satış sona erdi",
  closed: "Satış kapalı",
};

export function saleStateLabel(state: SaleState): string {
  return LABELS[state];
}
