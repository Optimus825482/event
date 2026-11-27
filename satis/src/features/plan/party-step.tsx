"use client";

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
