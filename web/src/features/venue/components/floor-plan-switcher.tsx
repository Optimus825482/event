"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FloorPlan3D } from "./floor-plan-3d";
import { FloorPlanView, type FloorPlanViewProps } from "./floor-plan-view";

const MODES = [
  { id: "2d", label: "2B" },
  { id: "3d", label: "3B" },
] as const;

type Mode = (typeof MODES)[number]["id"];

/** Alan planını 2B (varsayılan) ya da 3B gösterir; aynı özellikleri iki görünüme de geçirir. */
export function FloorPlanSwitcher(props: FloorPlanViewProps) {
  const [mode, setMode] = useState<Mode>("2d");
  const empty = props.plan.tables.length === 0 && props.plan.decor.length === 0;
  return (
    <div className="space-y-2">
      {empty ? null : (
        <div role="group" aria-label="Görünüm" className="flex justify-end gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m.id
                  ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      {mode === "3d" && !empty ? <FloorPlan3D {...props} /> : <FloorPlanView {...props} />}
    </div>
  );
}
