"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PartyStep({
  max,
  initial,
  onConfirm,
}: {
  max: number;
  initial: number;
  onConfirm(partySize: number): void;
}) {
  const clamped = Math.max(1, Math.min(max, initial));
  const [size, setSize] = useState(clamped);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(size);
      }}
      className="mx-auto flex max-w-md flex-col gap-4 rounded-xl border border-line bg-surface p-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="party-step-select" className="text-base font-semibold text-ivory">
          Kaç kişisiniz?
        </label>
        <select
          id="party-step-select"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-line bg-bg px-3 text-base text-ivory"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} kişi
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="lg">
        Masaları göster
      </Button>
    </form>
  );
}

export function PartySizeField({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange(partySize: number): void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <label htmlFor="party-size-field" className="text-sm font-medium text-ivory">
        Kişi sayısı
      </label>
      <select
        id="party-size-field"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-ivory disabled:opacity-50"
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n} kişi
          </option>
        ))}
      </select>
    </div>
  );
}
