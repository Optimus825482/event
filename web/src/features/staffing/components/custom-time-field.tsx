"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasCustomTimes, overrideTimesError } from "../service-point-roles";
import { hhmm, orNull } from "./bits";
import { useOrganization } from "./store";

type TimedAssignment = { id: string; shiftId: string | null; shiftStart: string | null; shiftEnd: string | null };

/**
 * "Özel saat": kişinin vardiya saatini ezen başlangıç–bitiş. Alanlar vardiyanın saatiyle dolu
 * gelir; değiştirilen saat iki alanı birlikte yazar. Vardiyayla aynı saat kaydedilmez.
 */
export function CustomTimeField({ assignment, readOnly }: { assignment: TimedAssignment; readOnly: boolean }) {
  const shifts = useOrganization((s) => s.reference.shifts);
  const update = useOrganization((s) => s.updateAssignment);
  const shift = shifts.find((s) => s.id === assignment.shiftId);
  const custom = hasCustomTimes(assignment, shift);
  const [open, setOpen] = useState(false);
  const start = assignment.shiftStart ?? shift?.startTime ?? null;
  const end = assignment.shiftEnd ?? shift?.endTime ?? null;
  const error = overrideTimesError(assignment.shiftStart, assignment.shiftEnd);
  const label = custom ? `Özel saat ${hhmm(start)}–${hhmm(end)}` : "Özel saat";

  const write = (next: { start?: string | null; end?: string | null }) =>
    update(assignment.id, {
      shiftStart: next.start !== undefined ? next.start : start,
      shiftEnd: next.end !== undefined ? next.end : end,
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={custom ? "secondary" : "ghost"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Clock aria-hidden className="size-4" />
        {label}
      </Button>
      {open ? (
        <>
          <Input
            type="time"
            aria-label="Özel başlangıç saati"
            className="h-8 w-28"
            value={hhmm(start)}
            disabled={readOnly}
            onChange={(e) => write({ start: orNull(e.target.value) })}
          />
          <span className="text-slate-400">–</span>
          <Input
            type="time"
            aria-label="Özel bitiş saati"
            className="h-8 w-28"
            value={hhmm(end)}
            disabled={readOnly}
            onChange={(e) => write({ end: orNull(e.target.value) })}
          />
          {readOnly || !(assignment.shiftStart || assignment.shiftEnd) ? null : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => update(assignment.id, { shiftStart: null, shiftEnd: null })}
            >
              {shift ? "Vardiya saatine dön" : "Saati temizle"}
            </Button>
          )}
          {shift ? null : <span className="text-xs text-slate-400">Vardiyasız atama</span>}
        </>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
