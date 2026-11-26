/** Tuvalde 50 piksel = 3B sahnede 1 birim (venue-3d-preview ile aynı ölçek). */
export const WALL_PX = 50;
/** Üst kat locaları (kat yüksekliği 3) duvarın içinde kalsın diye iki kat boyu. */
export const WALL_HEIGHT = 8;
export const WALL_MARGIN = 0.6;

export type WallSide = "back" | "left" | "right";

export type WallSpec = {
  side: WallSide;
  /** Duvarın dünya konumu (taban ortası). */
  position: [number, number, number];
  /** Y ekseni dönüşü; duvarın "ön" yüzü salonun içine bakar. */
  rotationY: number;
  /** Duvar uzunluğu. */
  length: number;
  height: number;
};

/**
 * Tuval genişliği/yüksekliğinden (piksel) arka, sol ve sağ duvarların yerleşimini üretir.
 * Zemin orijinde ortalıdır; ön taraf (+z) kamera için açık bırakılır.
 */
export function wallLayout(canvasWidth: number, canvasHeight: number): WallSpec[] {
  const w = Math.max(canvasWidth, 0) / WALL_PX;
  const h = Math.max(canvasHeight, 0) / WALL_PX;
  const xEdge = w / 2 + WALL_MARGIN;
  const zEdge = h / 2 + WALL_MARGIN;
  return [
    { side: "back", position: [0, 0, -zEdge], rotationY: 0, length: w + WALL_MARGIN * 2, height: WALL_HEIGHT },
    { side: "left", position: [-xEdge, 0, 0], rotationY: Math.PI / 2, length: h + WALL_MARGIN * 2, height: WALL_HEIGHT },
    { side: "right", position: [xEdge, 0, 0], rotationY: -Math.PI / 2, length: h + WALL_MARGIN * 2, height: WALL_HEIGHT },
  ];
}

/** Logoyu en/boy oranını koruyarak kutuya (maxW x maxH) sığdırır. */
export function fitLogo(aspect: number, maxW: number, maxH: number): { width: number; height: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const width = Math.min(maxW, maxH * a);
  return { width, height: width / a };
}
