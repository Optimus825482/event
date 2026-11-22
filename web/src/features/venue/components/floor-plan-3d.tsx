"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { FloorPlanViewProps } from "./floor-plan-view";
import { planToSceneTables } from "./venue-3d-scene-data";

// three.js yalnızca 3B açılınca indirilir; sunucuda çizilmez.
const Scene3D = dynamic(() => import("./venue-3d-scene"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full min-h-56 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-400"
      aria-busy="true"
    >
      3B plan yükleniyor…
    </div>
  ),
});

/** Salt okunur alan planının 3B görünümü: seçili masa parlar ve halkayla işaretlenir, durum renkleri uygulanır. */
export function FloorPlan3D({ plan, statuses, selectedId, disabledIds, colorByTable, outlinedIds, compact, height, ariaLabel }: FloorPlanViewProps) {
  const tables = useMemo(
    () => planToSceneTables(plan, { statuses, selectedId, disabledIds, colorByTable, outlinedIds }),
    [plan, statuses, selectedId, disabledIds, colorByTable, outlinedIds],
  );
  const px = height ?? (compact ? 220 : 420);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700" style={{ height: px }}>
      <Scene3D tables={tables} elements={plan.decor} canvas={plan.canvas} ariaLabel={ariaLabel ? `${ariaLabel} (3B)` : "Alan planı (3B)"} />
    </div>
  );
}
