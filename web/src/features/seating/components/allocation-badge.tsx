import { Badge } from "@/components/ui/badge";
import { ALLOCATION_LABELS, type TableAllocation } from "@/domain/seating";
import { cn } from "@/lib/utils";

/**
 * Tahsis rozet tonları: açık temada koyu metin / açık zemin, koyu temada açık metin / yarı saydam zemin.
 * Etiket metni her zaman görünür; renk tek başına bilgi taşımaz.
 */
export const ALLOCATION_TONES: Record<TableAllocation, string> = {
  pending: "border-slate-500 bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-400/15 dark:text-slate-100",
  casino: "border-violet-600 bg-violet-100 text-violet-950 dark:border-violet-400 dark:bg-violet-400/15 dark:text-violet-100",
  online:
    "border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-400/15 dark:text-emerald-100",
  closed: "border-red-700 bg-red-100 text-red-950 dark:border-red-400 dark:bg-red-400/15 dark:text-red-100",
};

export const INFO_TONES = {
  loca: "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-400/15 dark:text-amber-100",
  reserved: "border-sky-700 bg-sky-100 text-sky-950 dark:border-sky-400 dark:bg-sky-400/15 dark:text-sky-100",
} as const;

export function AllocationBadge({ allocation, className }: { allocation: TableAllocation; className?: string }) {
  return (
    <Badge variant="outline" className={cn(ALLOCATION_TONES[allocation], className)}>
      {ALLOCATION_LABELS[allocation]}
    </Badge>
  );
}
