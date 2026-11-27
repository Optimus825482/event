"use client";

import { useId, useState } from "react";
import type { EventDetail } from "@/lib/core/contract";
import type { PlanModel } from "./model";
import type { SeatView } from "./plan-3d";
import { PlanLegend } from "./plan-legend";
import type { usePlanView } from "./plan-view";
import { PlanViewer } from "./plan-viewer";
import { SightlinePanel } from "./sightline-panel";

export type SalonBrowserProps = {
  event: EventDetail;
  model: PlanModel;
  view: ReturnType<typeof usePlanView>;
  artworkUrl: string | null;
};

/**
 * Seçim yapılamazken (satış kapalı ya da kişi sayısı henüz sorulurken) salonu gezdirir:
 * 3B/2B plan, masaya dokununca o masanın sahne görüşü ve 3B göz hizası. Sandalye seçimi ve tutma yoktur.
 */
export function SalonBrowser({ event, model, view, artworkUrl }: SalonBrowserProps) {
  const [tableId, setTableId] = useState<string | null>(null);
  const [seatView, setSeatView] = useState<SeatView | null>(null);
  const selectId = useId();
  const table = tableId ? (model.tables.find((t) => t.id === tableId) ?? null) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex flex-col gap-3">
        <PlanViewer
          model={model}
          view={view}
          activeTableId={tableId}
          artworkUrl={artworkUrl}
          title={event.name}
          seatView={seatView}
          onTable={setTableId}
        />
        <PlanLegend prices={event.prices} currency={event.currency} />
      </div>
      <aside aria-label="Salon ve sahne görüşü" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3">
          <label htmlFor={selectId} className="text-sm font-medium text-ivory">
            Masa veya loca
          </label>
          <select
            id={selectId}
            value={tableId ?? ""}
            onChange={(e) => setTableId(e.target.value || null)}
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-ivory"
          >
            <option value="">Masa veya loca seçin</option>
            {model.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {`${t.isLoca ? "Loca" : "Masa"} ${t.label}`}
              </option>
            ))}
          </select>
        </div>
        <SightlinePanel
          set={event.site.sightlineSet}
          table={table ? { label: table.label, isLoca: table.isLoca } : null}
          canLookIn3d={view.can3d && !view.failed}
          onLookIn3d={() => {
            if (!table) return;
            view.setMode("3d");
            setSeatView((sv) => ({ tableId: table.id, nonce: (sv?.nonce ?? 0) + 1 }));
          }}
        />
      </aside>
    </div>
  );
}
