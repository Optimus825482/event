"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { ThreeDUnavailableReason } from "./device";
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

const BROWSE_3D_HINT =
  "Döndürmek için sürükleyin, yakınlaşmak için tekerleği ya da iki parmağınızı kullanın. Masaya dokununca o masadan sahne görüşü gösterilir.";

const UNAVAILABLE_3D_MESSAGE: Record<ThreeDUnavailableReason, string> = {
  no_webgl:
    "Tarayıcınızda WebGL (donanım hızlandırma) kapalı veya desteklenmiyor; 2B salon krokisi gösteriliyor. 3B görünüm için tarayıcı ayarlarından donanım hızlandırmayı açabilirsiniz.",
  save_data: "Tarayıcınızda veri tasarrufu modu açık olduğu için 2B salon krokisi gösteriliyor.",
  low_spec: "Cihaz donanımı nedeniyle 2B salon krokisi gösteriliyor.",
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
    <div className="flex flex-col gap-2.5">
      {view.failed ? <Notice>3B görünüm açılamadı; 2B plan gösteriliyor.</Notice> : null}
      {!view.failed && !view.can3d && view.reason ? <Notice>{UNAVAILABLE_3D_MESSAGE[view.reason]}</Notice> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wider text-muted uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
          {view.detecting || view.show3d ? "3B Salon Planı" : "2B Kroki"}
        </span>
        {view.can3d && !view.failed ? (
          <Button
            variant="glass"
            aria-pressed={view.show3d}
            onClick={() => view.setMode(view.show3d ? "2d" : "3d")}
            className="min-h-9 px-3.5 py-1.5 text-xs font-semibold"
          >
            {view.show3d ? "2B görünüm" : "3B görünüm"}
          </Button>
        ) : null}
      </div>
      {view.detecting ? (
        <div
          role="status"
          className="flex h-[min(64dvh,480px)] min-h-[360px] w-full items-center justify-center rounded-[20px] border border-line-gold bg-bg text-sm text-muted sm:h-[clamp(480px,72dvh,720px)]"
        >
          3B salon yükleniyor…
        </div>
      ) : view.show3d ? (
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
          hint={onSeat ? undefined : BROWSE_3D_HINT}
          onFail={view.fail}
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
