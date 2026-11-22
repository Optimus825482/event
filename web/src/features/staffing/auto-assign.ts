import type { AutoAssignStrategy } from "./schemas";

/** Otomatik dağıtım için gereken masa alanları (`event_tables` satırı ile uyumlu). */
export type PlannableTable = { id: string; label: string; x: number; y: number; isLoca: boolean };

export type AutoAssignPlan = Array<{ staffId: string; tableIds: string[] }>;

const labelCollator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

/** mulberry32: küçük, deterministik sözde rastgele üreteç (aynı tohum → aynı dizi). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

function byLabel(a: PlannableTable, b: PlannableTable): number {
  return labelCollator.compare(a.label, b.label) || a.id.localeCompare(b.id);
}

function byPosition(a: PlannableTable, b: PlannableTable): number {
  return a.x - b.x || a.y - b.y || byLabel(a, b);
}

/**
 * Masaları personele dağıtır. Localar (`is_loca`) hiçbir stratejide dağıtılmaz.
 * - balanced: etikete göre (doğal sıra) art arda dilimler
 * - zone: x, sonra y koordinatına göre bölgeler
 * - random: tohumlu karıştırma (tohum verilmezse rastgele tohum)
 * Dilim boyları en çok 1 farklıdır; fazla masa baştaki personele düşer.
 */
export function planAutoAssign(
  tables: readonly PlannableTable[],
  staffIds: readonly string[],
  strategy: AutoAssignStrategy,
  seed?: number,
): AutoAssignPlan {
  const assignable = tables.filter((t) => !t.isLoca);
  let ordered: PlannableTable[];
  if (strategy === "zone") ordered = [...assignable].sort(byPosition);
  else if (strategy === "random") {
    const random = seededRandom(seed ?? Math.floor(Math.random() * 2 ** 31));
    ordered = shuffle([...assignable].sort(byLabel), random);
  } else ordered = [...assignable].sort(byLabel);

  const count = staffIds.length;
  if (count === 0) return [];
  const base = Math.floor(ordered.length / count);
  const extra = ordered.length % count;
  let cursor = 0;
  return staffIds.map((staffId, index) => {
    const size = base + (index < extra ? 1 : 0);
    const slice = ordered.slice(cursor, cursor + size).map((t) => t.id);
    cursor += size;
    return { staffId, tableIds: slice };
  });
}
