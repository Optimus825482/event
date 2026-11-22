import { MAX_ZOOM, MIN_ZOOM, clampZoom, zoomAround, type Point } from "./editor/geometry";

export type Size = { width: number; height: number };
export type View = { scale: number; x: number; y: number };

export const FIT_PADDING = 24;
const MAX_FIT_SCALE = 1.5;

/** Tuvali kapsayıcıya sığdırır ve ortalar; ölçek [MIN_ZOOM, 1.5] aralığında kalır. */
export function fitView(canvas: Size, container: Size, padding = FIT_PADDING): View {
  if (canvas.width <= 0 || canvas.height <= 0) return { scale: 1, x: 0, y: 0 };
  const raw = Math.min((container.width - padding * 2) / canvas.width, (container.height - padding * 2) / canvas.height);
  const scale = Math.min(MAX_FIT_SCALE, Math.max(MIN_ZOOM, Number.isFinite(raw) ? raw : 1));
  return { scale, x: (container.width - canvas.width * scale) / 2, y: (container.height - canvas.height * scale) / 2 };
}

/** Kapsayıcının merkezini sabit tutarak yakınlaştırır/uzaklaştırır. */
export function zoomBy(view: View, container: Size, factor: number): View {
  return zoomAround(view, { x: container.width / 2, y: container.height / 2 }, view.scale * factor);
}

/** Dünya noktasını kapsayıcının ortasına getirir; ölçek en az `minScale` olur (bulunan masa görünsün). */
export function centerOn(point: Point, container: Size, view: View, minScale = 1): View {
  const scale = clampZoom(Math.max(view.scale, minScale));
  return { scale, x: container.width / 2 - point.x * scale, y: container.height / 2 - point.y * scale };
}

export function isZoomAtLimit(view: View): { min: boolean; max: boolean } {
  return { min: view.scale <= MIN_ZOOM + 1e-9, max: view.scale >= MAX_ZOOM - 1e-9 };
}

/** Etikette (Türkçe büyük/küçük harf duyarsız) geçen masalar; boş sorgu hiçbirini döndürmez. */
export function searchTables<T extends { label: string }>(tables: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q) return [];
  return tables.filter((t) => t.label.toLocaleLowerCase("tr").includes(q));
}
