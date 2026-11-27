"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { PlanModel } from "./model";
import type { TablePick } from "./picks";
import { Plan3D, type SeatView } from "./plan-3d";
import { PlanSvg } from "./plan-svg";
import type { usePlanView } from "./plan-view";

export type PlanViewerProps = {
  model: PlanModel;
  view: ReturnType<typeof usePlanView>;
  picks?: readonly TablePick[];
  activeTableId?: string | null;
  dimmedIds?: ReadonlySet<string>;
  artworkUrl?: string | null;
  title?: string;
  seatView?: SeatView | null;
  onTable?(tableId: string): void;
  onSeat?(tableId: string, seatNo: number): void;
};

/** 3B balo salonu (varsayılan) ve 2B plan görünümü; seçim üst bileşendedir, görünüm değişince korunur. */
export function PlanViewer({
  model,
  view,
  picks = [],
  activeTableId = null,
  dimmedIds,
  artworkUrl,
  title,
  seatView,
  onTable,
  onSeat,
}: PlanViewerProps) {
  const pickedIds = useMemo(() => new Set(picks.map((p) => p.tableId)), [picks]);
  const interactive = onTable !== undefined;

  return (
    <div className="flex flex-col gap-3">
      {view.failed ? <Notice>3B görünüm açılamadı; 2B plan gösteriliyor.</Notice> : null}
      {view.can3d && !view.failed ? (
        <div>
          <Button variant="glass" aria-pressed={view.show3d} onClick={() => view.setMode(view.show3d ? "2d" : "3d")}>
            {view.show3d ? "2B görünüm" : "3B görünüm"}
          </Button>
        </div>
      ) : null}
      {view.show3d ? (
        <Plan3D
          model={model}
          picks={picks}
          activeTableId={activeTableId}
          dimmedIds={dimmedIds}
          artworkUrl={artworkUrl}
          title={title}
          seatView={seatView}
          onTable={onTable}
          onSeat={onSeat}
          onFail={view.fail}
          fallback={<PlanSvg model={model} pickedIds={pickedIds} activeId={activeTableId} dimmedIds={dimmedIds} />}
        />
      ) : (
        <PlanSvg
          model={model}
          pickedIds={pickedIds}
          activeId={activeTableId}
          dimmedIds={dimmedIds}
          onSelect={interactive ? onTable : undefined}
        />
      )}
    </div>
  );
}
