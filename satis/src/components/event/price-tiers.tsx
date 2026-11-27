import type { EventDetail } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";

export function PriceTiers({
  prices,
  currency,
}: {
  prices: EventDetail["prices"];
  currency: string;
}): React.JSX.Element | null {
  if (prices.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-line-gold bg-surface p-4">
      <p className="text-[11.5px] font-bold tracking-wider text-gold-bright uppercase">Fiyat Kategorileri</p>
      <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {prices.map((tier) => (
          <div key={tier.category} className="flex items-baseline gap-1.5">
            <span className="text-muted">{`${tier.label}:`}</span>
            <strong className="font-semibold text-gold-bright">{formatMoney(tier.price, currency)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
