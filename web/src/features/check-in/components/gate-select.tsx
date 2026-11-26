"use client";

import { useId } from "react";
import { CHECK_IN_GATES, gateLabel, parseGate } from "../gates";

/** Cihazın kapısı; seçilmemişse girişler kapı bilgisi olmadan kaydedilir. */
export function GateSelect({ gate, onChange }: { gate: number | null; onChange: (g: number | null) => void }) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          Kapı
        </label>
        <select
          id={id}
          value={gate ?? ""}
          onChange={(e) => onChange(parseGate(e.target.value))}
          aria-describedby={gate === null ? noteId : undefined}
          className="h-8 rounded-md border border-slate-500 bg-slate-800 px-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <option value="">Seçilmedi</option>
          {CHECK_IN_GATES.map((g) => (
            <option key={g} value={g}>
              {gateLabel(g)}
            </option>
          ))}
        </select>
      </div>
      {gate === null ? (
        <p id={noteId} className="text-xs text-slate-400">
          Kapı seçilmedi; girişler kapı bilgisi olmadan kaydedilir.
        </p>
      ) : null}
    </div>
  );
}
