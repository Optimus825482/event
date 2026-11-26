import { STAGE_LABELS, type PlanningStage } from "@/domain/planning-stage";
import type { EventStatus } from "@/domain/event-status";
import { isStageFrozen } from "@/features/planning/allowed";
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

const MUTED_TONE = "border-slate-600/30 bg-slate-700/20 text-slate-500";

/**
 * Liste satırlarında planlama aşaması rozeti. Tamamlanmış/iptal edilmiş etkinlikte aşama artık
 * ilerlemez; canlı görünmesin diye soluk çizilir (etiket aynı kalır).
 */
export function StageBadge({
  stage,
  status,
  className,
}: {
  stage: PlanningStage;
  status?: EventStatus;
  className?: string;
}) {
  const muted = status !== undefined && isStageFrozen(status);
  return (
    <Badge
      variant="outline"
      data-testid="stage-badge"
      {...(muted ? { "data-muted": "true" } : {})}
      className={cn(muted ? MUTED_TONE : TONES[stage], className)}
    >
      {STAGE_LABELS[stage]}
    </Badge>
  );
}
