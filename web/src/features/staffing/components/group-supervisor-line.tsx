"use client";

import { useSupervisorName } from "./group-supervisor-field";
import type { DraftGroup } from "./store";

/** Grup kartında süpervizörün adı (seçilmemişse hiçbir şey göstermez). */
export function GroupSupervisorLine({ group }: { group: DraftGroup }) {
  const name = useSupervisorName(group.supervisorStaffId);
  return name ? <p className="break-words text-xs text-slate-400">Süpervizör: {name}</p> : null;
}
