"use client";

import { useMemo } from "react";
import { useEditor, type TableTypeOption } from "./editor-context";
import { computeLayoutStats } from "./layout-stats-core";
import { CAPACITY_COLORS } from "./table-visual";

/** İstatistik bloğu: toplamlar, tip ve kapasite kırılımı, eski kapasite renk göstergesi. */
export function LayoutStats({ tableTypes }: { tableTypes: readonly TableTypeOption[] }) {
  const tables = useEditor((s) => s.tables);
  const stats = useMemo(() => {
    const names = new Map(tableTypes.map((t) => [t.id, t.name]));
    return computeLayoutStats(tables, (id) => names.get(id));
  }, [tables, tableTypes]);

  return (
    <section aria-label="İstatistikler" className="space-y-3">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">Toplam Masa</dt>
          <dd className="text-lg font-semibold">{stats.tables}</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">Toplam Loca</dt>
          <dd className="text-lg font-semibold">{stats.locas}</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">Toplam Kapasite</dt>
          <dd className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{stats.capacity}</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">VIP</dt>
          <dd className="text-lg font-semibold text-amber-600 dark:text-amber-400">{stats.vip}</dd>
        </div>
      </dl>

      {stats.byType.length > 0 ? (
        <div>
          <h2 className="mb-1 text-xs font-medium text-muted-foreground">Tipe göre</h2>
          <ul className="space-y-0.5 text-xs">
            {stats.byType.map((row) => (
              <li key={row.name} className="flex justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.count} adet · {row.capacity} kişi
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="mb-1 text-xs font-medium text-muted-foreground">Kapasiteye göre</h2>
        {stats.byCapacity.length > 0 ? (
          <ul className="space-y-0.5 text-xs">
            {stats.byCapacity.map((row) => (
              <li key={row.capacity} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: row.color }} />
                  {row.capacity} kişilik
                </span>
                <span className="text-muted-foreground">{row.count} adet</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Henüz masa yok.</p>
        )}
        <p className="mb-1 mt-2 text-xs text-muted-foreground">Renk göstergesi (tipsiz masalar en yakın kapasite rengini alır)</p>
        <ul className="flex flex-wrap gap-x-2 gap-y-1 text-xs" aria-label="Kapasite renk göstergesi">
          {CAPACITY_COLORS.map((c) => (
            <li key={c.capacity} className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: c.fill }} />
              {c.capacity}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
