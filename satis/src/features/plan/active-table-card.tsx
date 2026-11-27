"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { PlanTableModel } from "./model";
import type { TablePick } from "./picks";

export function ActiveTableCard({
  table,
  pick,
  unitPrice,
  currency,
  disabled,
  compact,
  onToggleSeat,
  onToggleWhole,
}: {
  table: PlanTableModel | null;
  pick: TablePick | null;
  unitPrice: string | null;
  currency: string;
  disabled?: boolean;
  /** Masa penceresinde: başlık ve çerçeve yok (pencere başlığı masayı adlandırır). */
  compact?: boolean;
  onToggleSeat(seatNo: number): void;
  onToggleWhole(): void;
}) {
  if (!table) {
    return (
      <section aria-label="Seçili masa" className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">Plandan ya da listeden bir masa seçin.</p>
      </section>
    );
  }

  const kindWord = table.isLoca ? "Loca" : "Masa";
  const frame = compact ? "flex flex-col gap-3" : "flex flex-col gap-3 rounded-xl border border-line bg-surface p-4";
  const title = `${kindWord} ${table.label}`;
  const priceText = unitPrice ? `${formatMoney(unitPrice, currency)} / kişi` : null;

  if (table.wholeOnly) {
    const seats = table.seats ?? 0;
    const isPicked = pick !== null;
    return (
      <section aria-label="Seçili masa" className={frame}>
        {compact ? null : (
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-ivory">{title}</h3>
            <span className="text-xs text-muted">
              {[table.categoryLabel, priceText].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
        <p className="text-sm text-muted">
          {seats} kişilik masa · {seats} bilet
        </p>
        <Button
          variant={isPicked ? "glass" : "gold"}
          disabled={disabled || table.status !== "available"}
          onClick={onToggleWhole}
        >
          {isPicked ? "Seçimi kaldır" : "Masanın tamamını seç"}
        </Button>
      </section>
    );
  }

  const pickedSet = new Set(pick && !pick.whole ? pick.seatNos : []);
  const freeSet = new Set(table.freeSeats);
  const closedCount = Math.max(0, table.capacity - table.seatNos.length);

  return (
    <section aria-label="Seçili masa" className={frame}>
      {compact ? null : (
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ivory">{title}</h3>
          <span className="text-xs text-muted">
            {[table.categoryLabel, priceText].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}
      <div role="group" aria-label={`${title} sandalyeleri`} className="grid grid-cols-6 gap-2">
        {table.seatNos.map((seatNo) => {
          const isPicked = pickedSet.has(seatNo);
          const isFree = freeSet.has(seatNo);
          const label = isPicked
            ? `Sandalye ${seatNo}, seçili`
            : isFree
              ? `Sandalye ${seatNo}, boş`
              : `Sandalye ${seatNo}, dolu`;

          return (
            <button
              key={seatNo}
              type="button"
              aria-label={label}
              aria-pressed={isFree ? isPicked : undefined}
              disabled={disabled || !isFree}
              onClick={() => onToggleSeat(seatNo)}
              className={cn(
                "min-h-11 min-w-11 rounded-lg border text-sm font-semibold transition-colors",
                !isFree
                  ? "cursor-not-allowed border-line bg-disabled-bg text-disabled-text"
                  : isPicked
                    ? "border-gold-bright bg-gold text-on-gold"
                    : "border-line bg-bg text-ivory hover:border-gold hover:bg-surface-raised",
              )}
            >
              {seatNo}
            </button>
          );
        })}
      </div>
      {closedCount > 0 ? <p className="text-xs text-muted">{closedCount} sandalye satışa kapalı.</p> : null}
    </section>
  );
}
