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

export type PlanRect = { x: number; y: number; width: number; height: number };

/** Ekran (sahne kapsayıcısı) noktasını görünümün dünya koordinatına çevirir. */
export function toWorld(point: Point, view: View): Point {
  const scale = view.scale === 0 ? 1 : view.scale;
  return { x: (point.x - view.x) / scale, y: (point.y - view.y) / scale };
}

/** İki köşeden pozitif boyutlu dikdörtgen (sürükleme yönünden bağımsız). */
export function rectFromPoints(a: Point, b: Point): PlanRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Merkezi (x, y) dikdörtgenin içinde (kenarlar dahil) kalan masaların kimlikleri, plan sırasıyla. */
export function tablesInRect<T extends { id: string; x: number; y: number }>(tables: readonly T[], rect: PlanRect): string[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return tables.filter((t) => t.x >= rect.x && t.x <= right && t.y >= rect.y && t.y <= bottom).map((t) => t.id);
}

/** Kement seçimi en az bu kadar ekran pikseli sürüklenince sayılır; daha azı tıklamadır. */
export const LASSO_MIN_PX = 4;

export function isLassoDrag(start: Point, end: Point, minPx = LASSO_MIN_PX): boolean {
  return Math.abs(end.x - start.x) >= minPx || Math.abs(end.y - start.y) >= minPx;
}
