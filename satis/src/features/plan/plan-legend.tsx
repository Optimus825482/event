import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { EventDetail } from "@/lib/core/contract";

const SWATCH: Record<EventDetail["prices"][number]["category"] | "sold_out" | "not_sellable", string> = {
  standard: "border-ivory bg-surface-raised",
  premium: "border-gold bg-surface-raised",
  vip: "border-gold-bright bg-gold",
  sold_out: "border-line bg-disabled-bg",
  not_sellable: "border-line bg-surface",
};

function Swatch({ kind }: { kind: keyof typeof SWATCH }) {
  return <span aria-hidden="true" className={cn("inline-block size-5 shrink-0 rounded-full border-2", SWATCH[kind])} />;
}

export function PlanLegend({ prices, currency }: { prices: EventDetail["prices"]; currency: string }) {
  return (
    <ul aria-label="Plan göstergesi" className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-ivory">
      {prices.map((p) => (
        <li key={p.category} className="flex items-center gap-2">
          <Swatch kind={p.category} />
          <span>{p.label}</span>
          <span className="text-muted">{formatMoney(p.price, currency)}</span>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <Swatch kind="sold_out" />
        <span>Dolu</span>
      </li>
      <li className="flex items-center gap-2">
        <Swatch kind="not_sellable" />
        <span>Satışta değil</span>
      </li>
    </ul>
  );
}
