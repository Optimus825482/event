import type { PlanStatus } from "@/features/venue/plan-status";

type GroupLike = { id: string; tableIds: string[] };
type TableLike = { id: string };

/**
 * Alan planı üzerinde grup renklendirmesi: plan bileşeni yalnızca dört durum rengi bildiği için
 * seçili grubun masaları "checked_in" (mavi), başka gruptakiler "pending" (amber), grupsuzlar "free" (yeşil) çizilir.
 */
export function groupPlanStatuses(
  tables: readonly TableLike[],
  groups: readonly GroupLike[],
  activeId: string | null,
): Record<string, PlanStatus> {
  const out: Record<string, PlanStatus> = {};
  for (const t of tables) out[t.id] = "free";
  for (const g of groups) {
    for (const id of g.tableIds) if (id in out) out[id] = g.id === activeId ? "checked_in" : "pending";
  }
  return out;
}

/** Masaları gruba toplu atar; her masa yalnızca tek grupta kalır (önceki grubundan çıkarılır). */
export function assignTablesToGroup<G extends GroupLike>(groups: readonly G[], groupId: string, tableIds: readonly string[]): G[] {
  const moving = new Set(tableIds);
  return groups.map((g) => {
    if (g.id === groupId) return { ...g, tableIds: [...g.tableIds, ...tableIds.filter((t) => !g.tableIds.includes(t))] };
    return g.tableIds.some((t) => moving.has(t)) ? { ...g, tableIds: g.tableIds.filter((t) => !moving.has(t)) } : g;
  });
}

/** Gruptaki tüm masaları serbest bırakır. */
export function clearGroupTables<G extends GroupLike>(groups: readonly G[], groupId: string): G[] {
  return groups.map((g) => (g.id === groupId ? { ...g, tableIds: [] } : g));
}

export type GroupCoverage = { total: number; grouped: number; ungrouped: number; percent: number };

export function groupCoverage(tables: readonly TableLike[], groups: readonly GroupLike[]): GroupCoverage {
  const grouped = new Set(groups.flatMap((g) => g.tableIds));
  const count = tables.filter((t) => grouped.has(t.id)).length;
  const total = tables.length;
  return { total, grouped: count, ungrouped: total - count, percent: total === 0 ? 0 : Math.round((count / total) * 100) };
}
