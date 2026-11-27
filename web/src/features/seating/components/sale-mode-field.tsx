"use client";

import { SALE_MODES, SALE_MODE_LABELS, type SaleMode } from "@/domain/seating";
import { cn } from "@/lib/utils";

export const SALE_MODE_HINTS: Record<SaleMode, string> = {
  table: "Her masa bütün olarak satılır",
  seat: "Alıcı numaralı sandalyeleri tek tek seçer; localar bütün satılır",
};

/** Etkinlik satış şekli seçicisi: masa bazlı veya sandalye bazlı. */
export function SaleModeField({
  value,
  onChange,
  disabled = false,
  locked = false,
  idPrefix = "",
}: {
  value: SaleMode;
  onChange: (mode: SaleMode) => void;
  disabled?: boolean;
  /** Satış başladıysa: seçenekler kapalıdır ve kilit notu gösterilir. */
  locked?: boolean;
  idPrefix?: string;
}) {
  const isDisabled = disabled || locked;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">Satış şekli</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {SALE_MODES.map((mode) => {
          const inputId = `${idPrefix}sale-mode-${mode}`;
          const labelId = `${inputId}-label`;
          const hintId = `${inputId}-hint`;
          const selected = value === mode;
          return (
            <label
              key={mode}
              htmlFor={inputId}
              className={cn(
                "flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border",
                isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-accent/40",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={`${idPrefix}sale-mode`}
                value={mode}
                checked={selected}
                disabled={isDisabled}
                aria-labelledby={labelId}
                aria-describedby={hintId}
                onChange={() => onChange(mode)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 space-y-0.5">
                <span id={labelId} className="block text-sm font-medium leading-snug">
                  {SALE_MODE_LABELS[mode]}
                </span>
                <span id={hintId} className="block text-xs text-muted-foreground">
                  {SALE_MODE_HINTS[mode]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {locked ? (
        <p className="text-sm text-muted-foreground">Satış başladıktan sonra satış şekli değiştirilemez</p>
      ) : null}
    </fieldset>
  );
}
