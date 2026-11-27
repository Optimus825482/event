"use client";

import { cn } from "@/lib/cn";
import type { EventDetail } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { fitsParty, type KindFilter } from "./finder";
import type { PlanTableModel } from "./model";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "table", label: "Masa" },
  { value: "loca", label: "Loca" },
];

export function TableFinder({
  tables,
  query,
  kind,
  partySize,
  activeTableId,
  pickedIds,
  prices,
  currency,
  onQuery,
  onKind,
  onFocus,
}: {
  tables: PlanTableModel[];
  query: string;
  kind: KindFilter;
  partySize: number;
  activeTableId: string | null;
  pickedIds: ReadonlySet<string>;
  prices: EventDetail["prices"];
  currency: string;
  onQuery(q: string): void;
  onKind(k: KindFilter): void;
  onFocus(tableId: string): void;
}) {
  const priceByCat = new Map(prices.map((p) => [p.category, p.price]));

  return (
    <section aria-label="Masa bulucu" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
      <input
        type="search"
        aria-label="Masa numarası ara"
        placeholder="Masa numarası ara…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ivory placeholder:text-muted"
      />
      <div role="group" aria-label="Masa türü" className="grid grid-cols-3 gap-2">
        {KIND_OPTIONS.map((opt) => {
          const pressed = kind === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onKind(opt.value)}
              className={cn(
                "min-h-11 rounded-lg border px-2 text-sm font-medium transition-colors",
                pressed ? "border-gold bg-gold text-on-gold" : "border-line bg-bg text-ivory hover:bg-surface-raised",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {tables.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">Aramaya uyan masa yok.</p>
      ) : (
        <ul aria-label="Alınabilir masalar" className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
          {tables.map((table) => {
            const active = activeTableId === table.id;
            const picked = pickedIds.has(table.id);
            const price = table.category ? priceByCat.get(table.category) : undefined;
            const kindWord = table.isLoca ? "Loca" : "Masa";
            const fits = fitsParty(table, partySize);
            const parts = [
              `${kindWord} ${table.label}`,
              table.categoryLabel,
              table.wholeOnly
                ? `bütün olarak · ${table.seats ?? 0} kişilik`
                : `boş ${table.countLabel ?? ""}`,
              price ? formatMoney(price, currency) : null,
              picked ? "seçildi" : null,
            ].filter(Boolean);

            return (
              <li key={table.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFocus(table.id)}
                  className={cn(
                    "min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "border-gold bg-surface-raised text-ivory"
                      : picked
                        ? "border-gold bg-bg text-ivory"
                        : fits
                          ? "border-line bg-bg text-ivory hover:bg-surface-raised"
                          : "border-line bg-bg text-muted hover:bg-surface-raised",
                  )}
                >
                  {parts.join(" · ")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
