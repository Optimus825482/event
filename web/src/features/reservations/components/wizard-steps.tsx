import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WizardStep = { key: string; label: string; done: boolean };

/** Eski 3 adımlı sihirbazın üst şeridi: Misafir, Masa, Onay. Alanlar tek formda kaldığı için yalnızca ilerlemeyi gösterir. */
export function WizardSteps({ steps }: { steps: WizardStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Rezervasyon adımları" className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const active = index === (current === -1 ? steps.length - 1 : current);
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-4" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                step.done ? "bg-emerald-600 text-white" : active ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-400",
              )}
            >
              {step.done ? <Check className="size-4" /> : index + 1}
            </span>
            <span className={cn("text-sm font-medium", active || step.done ? "text-white" : "text-slate-400")}>{step.label}</span>
            {index < steps.length - 1 ? <span className="h-px w-6 bg-slate-700 sm:w-12" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Adım kartı: numaralı başlık ve içerik. */
export function WizardCard({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <span className="flex size-7 items-center justify-center rounded-full bg-purple-600/30 text-sm text-purple-300">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Plan göstergesi: Müsait / Rezerveli / Seçili. */
export function PlanLegend() {
  const items = [
    { label: "Müsait", color: "#22c55e" },
    { label: "Rezerveli", color: "#ef4444" },
    { label: "Seçili", color: "#a855f7" },
  ];
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-slate-400" aria-label="Plan göstergesi">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
