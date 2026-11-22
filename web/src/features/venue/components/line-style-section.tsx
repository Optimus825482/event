"use client";

import { cn } from "@/lib/utils";
import { lineKey, lineLength } from "../editor/lines";
import { LINE_COLORS, LINE_WIDTHS, type DecorLine } from "../schemas";
import { useEditorStore } from "./editor-context";

const COLOR_NAMES: Record<(typeof LINE_COLORS)[number], string> = {
  "#ef4444": "Kırmızı",
  "#f59e0b": "Turuncu",
  "#22c55e": "Yeşil",
  "#38bdf8": "Mavi",
  "#a855f7": "Mor",
  "#e2e8f0": "Beyaz",
};

/** Seçili çizgi(ler)in rengi ve kalınlığı; sabit palet ve kalınlık listesinden seçilir. */
export function LineStyleSection({ lines, readOnly }: { lines: readonly DecorLine[]; readOnly: boolean }) {
  const store = useEditorStore();
  const first = lines[0];
  if (!first) return null;
  const keys = lines.map((l) => lineKey(l.id));
  const sameColor = lines.every((l) => l.color === first.color);
  const sameWidth = lines.every((l) => l.width === first.width);
  const update = (patch: Partial<Pick<DecorLine, "color" | "width">>) => store.getState().updateLines(keys, patch);

  return (
    <section className="space-y-3" aria-label="Çizgi özellikleri">
      <h2 className="font-medium">{lines.length === 1 ? "Çizgi" : `${lines.length} çizgi seçili`}</h2>
      {lines.length === 1 ? <p className="text-xs text-muted-foreground">Uzunluk: {Math.round(lineLength(first))} px</p> : null}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Renk</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Çizgi rengi">
          {LINE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={sameColor && first.color === color}
              aria-label={COLOR_NAMES[color]}
              title={COLOR_NAMES[color]}
              disabled={readOnly}
              onClick={() => update({ color })}
              className={cn(
                "size-6 rounded-full border border-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                sameColor && first.color === color && "ring-2 ring-sky-400 ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Kalınlık</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Çizgi kalınlığı">
          {LINE_WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              role="radio"
              aria-checked={sameWidth && first.width === width}
              aria-label={`${width} px`}
              disabled={readOnly}
              onClick={() => update({ width })}
              className={cn(
                "flex h-8 w-12 items-center justify-center rounded-md border border-slate-600 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                sameWidth && first.width === width && "border-sky-400 bg-slate-800",
              )}
            >
              <span aria-hidden className="block w-7 rounded-full bg-slate-200" style={{ height: width }} />
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Uçları sürükleyerek uzatın; Shift yatay/dikey tutar. Silmek için Delete.</p>
    </section>
  );
}
