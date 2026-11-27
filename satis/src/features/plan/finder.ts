import type { PlanModel, PlanTableModel } from "./model";

export type KindFilter = "all" | "table" | "loca";

export function fitsParty(table: PlanTableModel, partySize: number): boolean {
  if (table.wholeOnly) return (table.seats ?? 0) >= partySize;
  return table.freeSeats.length >= partySize;
}

function matchesKind(table: PlanTableModel, kind: KindFilter): boolean {
  if (kind === "loca") return table.isLoca;
  if (kind === "table") return !table.isLoca;
  return true;
}

function matchesQuery(table: PlanTableModel, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return table.label.toLowerCase().includes(normalizedQuery);
}

export function findTables(
  model: PlanModel,
  opts: { query: string; kind: KindFilter; partySize: number },
): PlanTableModel[] {
  const q = opts.query.trim().toLowerCase();
  return model.tables
    .filter((t) => t.status === "available" && matchesKind(t, opts.kind) && matchesQuery(t, q))
    .sort((a, b) => {
      if (q) {
        const aExact = a.label.toLowerCase() === q ? 0 : 1;
        const bExact = b.label.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
      }
      const aFits = fitsParty(a, opts.partySize) ? 0 : 1;
      const bFits = fitsParty(b, opts.partySize) ? 0 : 1;
      if (aFits !== bFits) return aFits - bFits;
      return a.label.localeCompare(b.label, "tr", { numeric: true, sensitivity: "base" });
    });
}

export function dimmedTableIds(model: PlanModel, opts: { query: string; kind: KindFilter }): Set<string> {
  const q = opts.query.trim().toLowerCase();
  if (!q && opts.kind === "all") return new Set();
  const dimmed = new Set<string>();
  for (const t of model.tables) {
    if (t.status !== "available" || !matchesKind(t, opts.kind) || !matchesQuery(t, q)) {
      dimmed.add(t.id);
    }
  }
  return dimmed;
}
