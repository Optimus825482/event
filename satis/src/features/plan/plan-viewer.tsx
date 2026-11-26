"use client";

import { PlanSvg } from "./plan-svg";
import type { PlanModel } from "./model";

/** Salt görüntüleme: masa seçimi yok (Task 7 `EventSales` ile değiştirir). */
export function PlanViewer({ model }: { model: PlanModel }) {
  return <PlanSvg model={model} selectedId={null} />;
}
