"use client";

import { useMemo, useState } from "react";
import { FloorPlanView } from "@/features/venue/components/floor-plan-view";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { cn } from "@/lib/utils";
import type { LeaderEventTeam } from "../leader-queries";

type Props = {
  plan: FloorPlanData;
  teams: LeaderEventTeam[];
  assignedTableIds: string[];
  tableLabels: Record<string, string>;
};

/** Atanan masaların kat planı: ekip ya da personel seçilince yalnızca onların masaları vurgulanır. */
export function LeaderEventPlan({ plan, teams, assignedTableIds, tableLabels }: Props) {
  const [staffId, setStaffId] = useState<string | null>(null);

  const highlighted = useMemo(() => {
    if (!staffId) return new Set(assignedTableIds);
    for (const team of teams) {
      const member = team.members.find((m) => m.staffId === staffId);
      if (member) return new Set(member.tableIds);
    }
    return new Set<string>();
  }, [staffId, teams, assignedTableIds]);

  const dimmed = useMemo(() => plan.tables.filter((t) => !highlighted.has(t.id)).map((t) => t.id), [plan.tables, highlighted]);
  const labels = [...highlighted].map((id) => tableLabels[id]).filter((l): l is string => Boolean(l));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-cyan-400" /> Seçili masalar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-slate-600" /> Diğer masalar
        </span>
      </div>
      <FloorPlanView plan={plan} disabledIds={dimmed} ariaLabel="Atanan masaların kat planı" height={460} />
      <p className="text-sm text-slate-300">
        {labels.length === 0 ? "Bu seçim için atanmış masa yok." : `Masalar: ${labels.sort((a, b) => a.localeCompare(b, "tr", { numeric: true })).join(", ")}`}
      </p>
      <div className="space-y-3">
        <p className="text-sm font-medium text-white">Seçili personel</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStaffId(null)}
            aria-pressed={staffId === null}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              staffId === null
                ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                : "border-slate-700 text-slate-300 hover:bg-slate-800",
            )}
          >
            Tümü
          </button>
          {teams.flatMap((team) =>
            team.members.map((member) => (
              <button
                key={`${team.id}-${member.staffId}`}
                type="button"
                onClick={() => setStaffId(member.staffId)}
                aria-pressed={staffId === member.staffId}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  staffId === member.staffId
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800",
                )}
              >
                {member.fullName}
                {member.tableIds.length > 0 ? ` (${member.tableIds.length})` : ""}
              </button>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
