import { formatMoney } from "@/lib/format";
import { formatEventWhen } from "@/lib/time-zone";
import type { OrderResponse } from "@/lib/core/contract";

/** Sipariş özeti: etkinlik, tarih, satırlar ve toplam. */
export function OrderSummary({ order, categoryLabels }: { order: OrderResponse; categoryLabels: Record<string, string> }) {
  return (
    <section aria-label="Sipariş özeti" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <h2 className="m-0 text-xl font-semibold text-gold">{order.eventName}</h2>
      <p className="m-0 text-ivory">{formatEventWhen(order.startsAt)}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {order.items.map((item) => (
          <li key={item.tableId} className="text-ivory">
            {`Masa ${item.tableLabel} · ${categoryLabels[item.category] ?? item.category} · ${item.quantity} × ${formatMoney(item.unitPrice, order.currency)}`}
          </li>
        ))}
      </ul>
      <p className="m-0 text-xl font-semibold text-ivory">{`Toplam ${formatMoney(order.total, order.currency)}`}</p>
    </section>
  );
}
