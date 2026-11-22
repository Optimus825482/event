"use client";

import { useMemo } from "react";
import { rulerTicks } from "../editor/view-chrome";

export const RULER_SIZE = 22;

type Props = {
  canvas: { width: number; height: number };
  cellSize: number;
  view: { scale: number; x: number; y: number };
  size: { width: number; height: number };
  /** İmlecin altındaki hücre adı ("B3"); tuval dışında `null`. */
  position: string | null;
};

/** Tuvalin üstünde A–Z, solunda 1–n cetveli ve imleç konumu; yakınlaştırma/kaydırmayı izler. */
export function CanvasRulers({ canvas, cellSize, view, size, position }: Props) {
  const cols = useMemo(
    () => rulerTicks("x", canvas.width, cellSize, { scale: view.scale, offset: view.x }),
    [canvas.width, cellSize, view.scale, view.x],
  );
  const rows = useMemo(
    () => rulerTicks("y", canvas.height, cellSize, { scale: view.scale, offset: view.y }),
    [canvas.height, cellSize, view.scale, view.y],
  );
  const tick = "absolute text-[10px] leading-none text-slate-500 select-none";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden data-testid="canvas-rulers">
      <div
        className="absolute left-0 top-0 overflow-hidden border-b border-slate-700 bg-slate-900/85"
        style={{ height: RULER_SIZE, width: size.width }}
      >
        {cols
          .filter((t) => t.center > RULER_SIZE && t.center < size.width)
          .map((t) => (
            <span key={t.index} className={`${tick} -translate-x-1/2`} style={{ left: t.center, top: 6 }}>
              {t.label}
            </span>
          ))}
      </div>
      <div
        className="absolute left-0 top-0 overflow-hidden border-r border-slate-700 bg-slate-900/85"
        style={{ width: RULER_SIZE, height: size.height }}
      >
        {rows
          .filter((t) => t.center > RULER_SIZE && t.center < size.height)
          .map((t) => (
            <span key={t.index} className={`${tick} -translate-y-1/2 w-full text-center`} style={{ top: t.center }}>
              {t.label}
            </span>
          ))}
      </div>
      <div className="absolute left-0 top-0 border-b border-r border-slate-700 bg-slate-900" style={{ width: RULER_SIZE, height: RULER_SIZE }} />
      {position ? (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/90 px-3 py-1 text-xs text-slate-300">
          {`Konum: ${position}`}
        </span>
      ) : null}
    </div>
  );
}
