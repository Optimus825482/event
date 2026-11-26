export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
/** Görünüm: ekran = dünya * scale + (x, y). */
export type View = { scale: number; x: number; y: number };

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4;
export const TAP_SLOP_PX = 8;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** Tuvali kapsayıcıya sığdırır ve ortalar. */
export function fitView(canvas: Size, container: Size, padding = 12): View {
  const scale = clampScale(
    Math.min((container.width - 2 * padding) / canvas.width, (container.height - 2 * padding) / canvas.height),
  );
  return { scale, x: (container.width - canvas.width * scale) / 2, y: (container.height - canvas.height * scale) / 2 };
}

/** Ölçeği değiştirir; çapa (ekran) noktasının altındaki dünya noktası sabit kalır. */
export function zoomAround(view: View, anchor: Point, nextScale: number): View {
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;
  return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** İki parmak: başlangıçtaki orta noktanın altındaki dünya noktası şimdiki orta noktanın altında kalır. */
export function pinchView(start: { view: View; a: Point; b: Point }, now: { a: Point; b: Point }): View {
  const startDist = dist(start.a, start.b);
  const scale = clampScale(startDist === 0 ? start.view.scale : (start.view.scale * dist(now.a, now.b)) / startDist);
  const from = mid(start.a, start.b);
  const to = mid(now.a, now.b);
  const worldX = (from.x - start.view.x) / start.view.scale;
  const worldY = (from.y - start.view.y) / start.view.scale;
  return { scale, x: to.x - worldX * scale, y: to.y - worldY * scale };
}

export function isTap(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) < TAP_SLOP_PX;
}
