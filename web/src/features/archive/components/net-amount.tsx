import { cn } from "@/lib/utils";
import { formatMoney, isNegativeAmount } from "../format";

/** Net tutar; negatifte renk ve baştaki eksi işareti birlikte ayrışır. */
export function NetAmount({ amount, currency, className }: { amount: string; currency: string; className?: string }) {
  const negative = isNegativeAmount(amount);
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        negative ? "font-semibold text-red-700 dark:text-red-300" : "text-foreground",
        className,
      )}
    >
      {formatMoney(amount, currency)}
    </span>
  );
}
