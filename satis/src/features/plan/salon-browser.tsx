"use client";

import { useId, useState } from "react";
import type { EventDetail } from "@/lib/core/contract";
import { formatEventTime } from "@/lib/time-zone";
import type { PlanModel } from "./model";
import type { SeatView } from "./plan-3d";
import { PlanLegend } from "./plan-legend";
import type { usePlanView } from "./plan-view";
import { PlanViewer } from "./plan-viewer";
import { saleStateLabel } from "./sale-state";
import { formatStageMetrics, tableStageMetrics } from "./stage-metrics";
import { TableDialog } from "./table-dialog";

export type SalonBrowserProps = {
  event: EventDetail;
  model: PlanModel;
  view: ReturnType<typeof usePlanView>;
  artworkUrl: string | null;
};

/**
 * Satış kapalıyken tam genişlikte salonu gezdirir: 3B/2B plan; masaya dokununca (ya da listeden seçilince)
 * masa penceresi (sahne görüşü, fiyat, satış durumu) açılır.
 */
export function SalonBrowser({ event, model, view, artworkUrl }: SalonBrowserProps) {
  const [tableId, setTableId] = useState<string | null>(null);
  const [seatView, setSeatView] = useState<SeatView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selectId = useId();
  const table = tableId ? (model.tables.find((t) => t.id === tableId) ?? null) : null;
  const canLookIn3d = view.can3d && !view.failed;
  const metrics = table ? tableStageMetrics(model, table) : null;
  const unitPrice = table?.category ? (event.prices.find((p) => p.category === table.category)?.price ?? null) : null;

  const openTable = (id: string | null) => {
    setTableId(id);
    setDialogOpen(id !== null);
  };
  const lookFromTable = () => {
    if (!table) return;
    view.setMode("3d");
    setSeatView((sv) => ({ tableId: table.id, nonce: (sv?.nonce ?? 0) + 1 }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={selectId} className="text-xs font-semibold text-muted">
            Masa veya loca
          </label>
          <select
            id={selectId}
            value={tableId ?? ""}
            onChange={(e) => openTable(e.target.value || null)}
            className="min-h-10 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ivory focus:border-gold"
          >
            <option value="">Masa veya loca seçin</option>
            {model.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {`${t.isLoca ? "Loca" : "Masa"} ${t.label}`}
              </option>
            ))}
          </select>
        </div>

        {table ? (
          <button
            type="button"
            onClick={() => openTable(table.id)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-gold bg-glass px-3.5 py-1.5 text-xs font-semibold text-gold-bright transition-colors hover:border-gold"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
            {`Seçili: ${table.isLoca ? "Loca" : "Masa"} ${table.label}`}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-[16px] border border-line-gold bg-surface p-1.5 sm:p-2.5">
        <PlanViewer
          model={model}
          view={view}
          activeTableId={tableId}
          artworkUrl={artworkUrl}
          title={event.name}
          seatView={seatView}
          onTable={openTable}
        />
        <div className="border-t border-line pt-3">
          <PlanLegend prices={event.prices} currency={event.currency} />
        </div>
      </div>

      <TableDialog
        model={model}
        artworkUrl={artworkUrl}
        open={dialogOpen}
        table={table}
        eventName={event.name}
        eventTime={formatEventTime(event.startsAt)}
        sightlineSet={event.site.sightlineSet}
        metrics={metrics ? formatStageMetrics(metrics) : null}
        unitPrice={unitPrice}
        currency={event.currency}
        canLookIn3d={canLookIn3d}
        onLookIn3d={() => {
          setDialogOpen(false);
          lookFromTable();
        }}
        onClose={() => setDialogOpen(false)}
        sale={null}
        closedLabel={saleStateLabel(event.sale.state)}
      />
    </div>
  );
}
