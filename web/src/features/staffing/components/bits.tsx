"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { NativeSelect } from "@/features/staff/components/field";

/** Seçilebilir küçük düğme (masa, üye seçimi). */
export function Chip({
  active,
  color,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  color?: string | null;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-transparent text-white" : "border-border hover:bg-accent",
      )}
      style={active ? { backgroundColor: color ?? "#3b82f6" } : undefined}
    >
      {children}
    </button>
  );
}

export function Swatch({ color }: { color: string | null | undefined }) {
  return <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: color ?? "#94a3b8" }} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** "19:00:00" → "19:00" (input[type=time] için). */
export function hhmm(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function orNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}
