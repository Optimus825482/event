import { cn } from "@/lib/cn";

const STEPS = [
  { id: "masa", label: "Masa Seçimi" },
  { id: "odeme", label: "Ödeme" },
  { id: "bilet", label: "E-Bilet" },
] as const;

export function CheckoutSteps({ current }: { current: "masa" | "odeme" | "bilet" }): React.JSX.Element {
  return (
    <ol aria-label="Satın alma adımları" className="no-print flex flex-wrap items-center gap-4">
      {STEPS.map((step, i) => {
        const active = step.id === current;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={cn("inline-flex items-center gap-2 text-sm font-medium", active ? "text-ivory" : "text-muted")}
          >
            <span
              className={cn(
                "inline-flex h-[25px] w-[25px] items-center justify-center rounded-full text-xs font-bold",
                active ? "bg-gold text-on-gold" : "border border-line text-muted",
              )}
            >
              {i + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
