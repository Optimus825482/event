"use client";

import { MAX_RATING } from "../score";

type Props = {
  name: string;
  label: string;
  weight: number;
  value: number | null;
  disabled?: boolean;
  error?: string | undefined;
  onChange: (value: number) => void;
};

const OPTIONS = Array.from({ length: MAX_RATING + 1 }, (_, i) => i);

/** 0–5 arası tek seçimli puan girişi (klavye ile okla gezilir; her düğme bir radyo). */
export function RatingInput({ name, label, weight, value, disabled, error, onChange }: Props) {
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted-foreground">Ağırlık %{weight}</span>
      </legend>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {OPTIONS.map((option) => (
          <label
            key={option}
            className={`flex h-9 min-w-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${
              value === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
