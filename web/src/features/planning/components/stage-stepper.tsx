import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { stageSteps } from "../view-model";
import type { PlanningStage } from "@/domain/planning-stage";

/** Sekiz adımlı aşama çubuğu; dar ekranda yatay kayar, sayfa taşmaz. */
export function StageStepper({ stage }: { stage: PlanningStage }) {
  const steps = stageSteps(stage);
  return (
    <div className="relative max-w-full overflow-x-auto" data-testid="stage-stepper">
      <ol className="flex min-w-max gap-2 pb-2" aria-label="Planlama aşamaları">
        {steps.map((step, i) => (
          <li
            key={step.stage}
            aria-current={step.status === "current" ? "step" : undefined}
            className={cn(
              "flex w-32 shrink-0 flex-col gap-1 rounded-lg border p-2 text-xs",
              step.status === "done" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
              step.status === "current" && "border-blue-500 bg-blue-500/15 text-white",
              step.status === "upcoming" && "border-slate-700 bg-slate-800/60 text-slate-400",
            )}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                  step.status === "done" && "bg-emerald-500 text-slate-900",
                  step.status === "current" && "bg-blue-500 text-white",
                  step.status === "upcoming" && "bg-slate-700 text-slate-300",
                )}
                aria-hidden="true"
              >
                {step.status === "done" ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="sr-only">
                {step.status === "done" ? "Tamamlandı: " : step.status === "current" ? "Güncel: " : "Bekliyor: "}
              </span>
              <span className="leading-tight">{step.label}</span>
            </span>
            {step.department ? <span className="text-[11px] opacity-80">{step.department}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
