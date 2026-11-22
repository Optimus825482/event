"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";

export const fieldClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** Odaktan çıkınca (ya da Enter ile) yazılan alan: her tuş vuruşu geçmişe girmesin. */
export function CommitField({
  label,
  value,
  type = "text",
  disabled,
  onCommit,
  ...rest
}: {
  label: string;
  value: string | number;
  type?: "text" | "number";
  disabled: boolean;
  onCommit: (value: string) => void;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <input
        key={String(value)}
        id={id}
        type={type}
        defaultValue={value}
        disabled={disabled}
        className={fieldClass}
        onBlur={(e) => {
          if (e.currentTarget.value !== String(value)) onCommit(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        {...rest}
      />
    </div>
  );
}

export function toInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Seçilebilir düğme (renk/simge/boyut): seçili durum `aria-pressed` ile de bildirilir, yalnızca renkle değil. */
export function ChoiceButton({
  pressed,
  disabled,
  label,
  onClick,
  className = "",
  style,
  children,
}: {
  pressed: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`rounded-md border text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
        pressed ? "border-primary ring-2 ring-primary" : "border-input hover:bg-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}
