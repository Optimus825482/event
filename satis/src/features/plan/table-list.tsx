"use client";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { EventDetail } from "@/lib/core/contract";
import type { PlanModel } from "./model";

type TableListProps = {
  model: PlanModel;
  selectedId: string | null;
  onSelect(tableId: string): void;
  prices: EventDetail["prices"];
  currency: string;
};

/** Grafiksiz yedek görünüm: alınabilir masalar etikete göre sıralı düğmeler. */
export function TableList({ model, selectedId, onSelect, prices, currency }: TableListProps) {
  const priceByCategory = new Map(prices.map((p) => [p.category, p.price]));
  const rows = model.tables
    .filter((t) => t.status === "available")
    .sort((a, b) => a.label.localeCompare(b.label, "tr", { numeric: true }));
  if (rows.length === 0) return <p className="m-0 text-ivory">Şu anda alınabilir masa yok.</p>;
  return (
    <ul aria-label="Alınabilir masalar" className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((table) => {
        const price = table.category ? priceByCategory.get(table.category) : undefined;
        const text = [table.label, table.categoryLabel, table.countLabel, price ? formatMoney(price, currency) : null]
          .filter(Boolean)
          .join(" · ");
        const selected = table.id === selectedId;
        return (
          <li key={table.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(table.id)}
              className={cn(
                "flex min-h-11 w-full items-center rounded-lg border px-4 py-2 text-left text-ivory",
                selected ? "border-gold-bright bg-surface-raised font-semibold" : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              {text}
              {table.wholeOnly ? " · bütün olarak" : ""}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
