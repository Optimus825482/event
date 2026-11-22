import { capacityColor } from "./table-visual";

type StatTable = { capacity: number; isLoca: boolean; isVip: boolean; tableTypeId: string | null };

export type LayoutStats = {
  /** Loca olmayan masa sayısı. */
  tables: number;
  locas: number;
  capacity: number;
  vip: number;
  byType: Array<{ name: string; count: number; capacity: number }>;
  byCapacity: Array<{ capacity: number; count: number; color: string }>;
};

export const LOCA_ROW_NAME = "Loca";
export const UNTYPED_ROW_NAME = "Tipsiz";

/** Yerleşim istatistikleri: masa/loca sayısı, toplam kapasite, VIP ve tip/kapasite kırılımı. */
export function computeLayoutStats(
  tables: readonly StatTable[],
  typeName: (id: string) => string | undefined,
): LayoutStats {
  const byType = new Map<string, { name: string; count: number; capacity: number }>();
  const byCapacity = new Map<number, number>();
  let locas = 0;
  let vip = 0;
  let capacity = 0;
  for (const t of tables) {
    capacity += t.capacity;
    if (t.isLoca) locas += 1;
    if (t.isVip) vip += 1;
    byCapacity.set(t.capacity, (byCapacity.get(t.capacity) ?? 0) + 1);
    const name = t.isLoca ? LOCA_ROW_NAME : ((t.tableTypeId && typeName(t.tableTypeId)) || UNTYPED_ROW_NAME);
    const row = byType.get(name) ?? { name, count: 0, capacity: 0 };
    row.count += 1;
    row.capacity += t.capacity;
    byType.set(name, row);
  }
  return {
    tables: tables.length - locas,
    locas,
    capacity,
    vip,
    byType: [...byType.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr")),
    byCapacity: [...byCapacity.entries()]
      .sort(([a], [b]) => a - b)
      .map(([cap, count]) => ({ capacity: cap, count, color: capacityColor(cap).fill })),
  };
}
