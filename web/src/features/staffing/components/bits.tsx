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
        "rounded-lg border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-transparent text-white" : "border-slate-600 text-slate-300 hover:bg-slate-700",
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
    <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-white">{title}</h3>
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
