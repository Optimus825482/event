import { SALE_CATEGORY_LABELS } from "@/domain/seating";
import { cn } from "@/lib/utils";
import type { TableOccupancyRow } from "../queries";
import { occupancyLabel, occupancyTone } from "../view-model";

const TONES = {
  empty: "border-border text-muted-foreground",
  partial: "border-amber-400/50 bg-amber-500/15 text-amber-300",
  full: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300",
} as const;

const TONE_TEXT = { empty: "boş", partial: "kısmen dolu", full: "dolu" } as const;

/** Online masaların doluluğu: etiket, kategori, "dolu/yuva". */
export function OccupancyList({ rows }: { rows: TableOccupancyRow[] }) {
  return (
    <section aria-labelledby="orders-occupancy-heading" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 id="orders-occupancy-heading" className="text-lg font-semibold">
        Masa doluluğu
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Online satışa açık masa yok.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const tone = occupancyTone(row);
            return (
              <li key={row.tableId} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{SALE_CATEGORY_LABELS[row.category]}</p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums", TONES[tone])}>
                  {occupancyLabel(row)}
                  <span className="sr-only"> ({TONE_TEXT[tone]})</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
