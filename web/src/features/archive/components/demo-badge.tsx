import { cn } from "@/lib/utils";

/** Demo bilet işareti; gerçek satıştan ayrı okunur (renk + metin). */
export function DemoBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border border-amber-700 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200",
        className,
      )}
    >
      DEMO +{count} bilet
    </span>
  );
}
