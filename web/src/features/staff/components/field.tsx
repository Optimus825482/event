"use client";

import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string[]> | undefined;

export function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors: FieldErrors;
  children: ReactNode;
}) {
  const messages = errors?.[name];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {messages?.map((m) => (
        <p key={m} role="alert" className="text-xs text-destructive">
          {m}
        </p>
      ))}
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Boş dizgeyi null yapar; sunucu şemaları null değerini boş alan sayar. */
export function textOrNull(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function numberOrNull(fd: FormData, name: string): number | null {
  const v = textOrNull(fd, name);
  return v === null ? null : Number(v);
}
