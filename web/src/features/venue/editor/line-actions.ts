import { MAX_LINES, type DecorLine } from "../schemas";
import type { Point } from "./geometry";
import { DEFAULT_LINE_STYLE, isDrawable, lineKey, setEndpoint, translateLine, type LineEnd } from "./lines";
import type { EditorState, Snapshot } from "./types";

type Change = (next: Partial<Snapshot> & Partial<Pick<EditorState, "selection">>) => void;

export type LineActions = {
  /** İki uçtan çizgi ekler ve seçer; çok kısaysa ya da sınır doluysa `null`. */
  addLine: (a: Point, b: Point) => string | null;
  updateLines: (keys: readonly string[], patch: Partial<Pick<DecorLine, "color" | "width">>) => void;
  moveLineEnd: (key: string, end: LineEnd, p: Point) => void;
  translateLineBy: (key: string, dx: number, dy: number) => void;
};

/** Çizgi işlemleri; her değişiklik `change` ile geri al geçmişine girer. */
export function createLineActions(get: () => EditorState, change: Change, newId: () => string): LineActions {
  const replace = (key: string, fn: (l: DecorLine) => DecorLine) => {
    const s = get();
    const line = s.lines.find((l) => lineKey(l.id) === key);
    if (!line) return;
    const next = fn(line);
    if (next.x1 === line.x1 && next.y1 === line.y1 && next.x2 === line.x2 && next.y2 === line.y2) return;
    change({ lines: s.lines.map((l) => (l === line ? next : l)) });
  };
  return {
    addLine: (a, b) => {
      const s = get();
      if (!isDrawable(a, b) || s.lines.length >= MAX_LINES) return null;
      const previous = s.lines[s.lines.length - 1];
      const line: DecorLine = {
        id: newId(),
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        // Art arda çizilen çizgiler son çizginin biçimini sürdürür.
        color: previous?.color ?? DEFAULT_LINE_STYLE.color,
        width: previous?.width ?? DEFAULT_LINE_STYLE.width,
      };
      change({ lines: [...s.lines, line], selection: [lineKey(line.id)] });
      return lineKey(line.id);
    },
    updateLines: (keys, patch) => {
      const wanted = new Set(keys);
      const s = get();
      const lines = s.lines.map((l) =>
        wanted.has(lineKey(l.id)) && ((patch.color !== undefined && patch.color !== l.color) || (patch.width !== undefined && patch.width !== l.width))
          ? { ...l, ...patch }
          : l,
      );
      if (lines.some((l, i) => l !== s.lines[i])) change({ lines });
    },
    moveLineEnd: (key, end, p) => {
      const s = get();
      const line = s.lines.find((l) => lineKey(l.id) === key);
      if (!line) return;
      const moved = setEndpoint(line, end, p);
      if (!isDrawable({ x: moved.x1, y: moved.y1 }, { x: moved.x2, y: moved.y2 })) return;
      replace(key, () => moved);
    },
    translateLineBy: (key, dx, dy) => replace(key, (l) => translateLine(l, dx, dy, get().canvas)),
  };
}
