import { cn } from "@/lib/cn";

const INPUT_BASE = "min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ivory";

/** Metin alanı sınıfı; hatalıysa kenarlık tehlike renginde. */
export function inputClass(invalid: boolean): string {
  return cn(INPUT_BASE, invalid ? "border-danger" : "border-muted");
}

/**
 * Odak düğmede kalsın diye `disabled` yerine `aria-disabled` kullanan düğmelerin meşgul görünümü
 * (devre dışı belirteçleri; AA karşıtlığı).
 */
export const BUSY_CLASS = cn(
  "aria-disabled:cursor-not-allowed aria-disabled:border-transparent",
  "aria-disabled:bg-disabled-bg aria-disabled:text-disabled-text",
);
