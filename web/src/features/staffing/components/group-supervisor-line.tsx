"use client";

import { SupervisorLabel, useSupervisorInfo } from "./group-supervisor-field";
import type { DraftGroup } from "./store";

/** Grup kartında süpervizörün adı (seçilmemişse hiçbir şey göstermez); pasifse "Pasif" rozetiyle. */
export function GroupSupervisorLine({ group }: { group: DraftGroup }) {
  const info = useSupervisorInfo(group.supervisorStaffId);
  if (!info) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      Süpervizör: <SupervisorLabel info={info} />
    </p>
  );
}
