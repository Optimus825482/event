import { STAGE_LABELS, type PlanningStage } from "@/domain/planning-stage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<PlanningStage, string> = {
  defined: "border-slate-500/30 bg-slate-500/20 text-slate-300",
  layout_ready: "border-blue-500/30 bg-blue-500/20 text-blue-300",
  staffing_ready: "border-blue-500/30 bg-blue-500/20 text-blue-300",
  tables_classified: "border-purple-500/30 bg-purple-500/20 text-purple-300",
  casino_allocated: "border-purple-500/30 bg-purple-500/20 text-purple-300",
  priced: "border-amber-500/30 bg-amber-500/20 text-amber-300",
  on_sale: "border-green-500/30 bg-green-500/20 text-green-400",
  sales_closed: "border-slate-500/30 bg-slate-500/20 text-slate-300",
};

/** Liste satırlarında planlama aşaması rozeti. */
export function StageBadge({ stage, className }: { stage: PlanningStage; className?: string }) {
  return (
    <Badge variant="outline" data-testid="stage-badge" className={cn(TONES[stage], className)}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}
