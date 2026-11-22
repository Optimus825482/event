"use client";

import { useMemo } from "react";
import { tableShapeOf, useEditor, LOCA_COLOR, type TableTypeOption } from "./editor-context";
import { capacityColor, VIP_FILL } from "./table-visual";
import Venue3DScene from "./venue-3d-scene";
import type { SceneTable } from "./venue-3d-scene-data";

type Props = { tableTypes: readonly TableTypeOption[] };

/**
 * Düzenleyici yerleşiminin 3B önizlemesi (salt okunur): düzenleyici durumunu ortak 3B sahneye
 * (`Venue3DScene`) verir; çizim, ekran görüntüsü ve kat listesi sahnededir.
 */
export default function Venue3DPreview({ tableTypes }: Props) {
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const typeById = useMemo(() => new Map(tableTypes.map((t) => [t.id, t])), [tableTypes]);
  const sceneTables = useMemo<SceneTable[]>(
    () =>
      tables.map((t) => {
        const type = t.tableTypeId ? typeById.get(t.tableTypeId) : undefined;
        return {
          key: t.key,
          label: t.label,
          capacity: t.capacity,
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          isLoca: t.isLoca,
          floor: t.floor,
          size: t.size,
          shape: tableShapeOf(type),
          color: t.isVip ? VIP_FILL : t.isLoca ? LOCA_COLOR : (type?.color ?? capacityColor(t.capacity).fill),
          highlighted: false,
          dimmed: false,
        };
      }),
    [tables, typeById],
  );
  return <Venue3DScene tables={sceneTables} elements={elements} canvas={canvas} />;
}
