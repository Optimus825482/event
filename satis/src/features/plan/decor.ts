/** Planın süsleri (sahne, duvar…) ve çizgileri; çekirdekten `unknown[]` gelir, bozuk öğe atlanır. */
export const DECOR_KINDS = ["stage", "area", "wall", "label", "bar", "catwalk"] as const;

export type PlanDecor = {
  id: string;
  kind: (typeof DECOR_KINDS)[number];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
};

/** Çekirdekte dekor x,y SOL-ÜST köşedir; çizimde döndürme pivotu merkezdir. */
export function decorCenter(decor: Pick<PlanDecor, "x" | "y" | "width" | "height">): { x: number; y: number } {
  return { x: decor.x + decor.width / 2, y: decor.y + decor.height / 2 };
}

export type PlanLine = { id: string; x1: number; y1: number; x2: number; y2: number; width: number };

const MAX_LABEL = 60;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const num = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseDecor(raw: unknown[]): PlanDecor[] {
  return raw.flatMap((item): PlanDecor[] => {
    if (!isRecord(item)) return [];
    const { id, kind, x, y, width, height, rotation, label } = item;
    if (typeof id !== "string" || typeof kind !== "string") return [];
    if (!(DECOR_KINDS as readonly string[]).includes(kind)) return [];
    if (!num(x) || !num(y) || !num(width) || !num(height)) return [];
    return [
      {
        id,
        kind: kind as PlanDecor["kind"],
        x,
        y,
        width,
        height,
        rotation: num(rotation) ? rotation : 0,
        label: typeof label === "string" ? label.slice(0, MAX_LABEL) : "",
      },
    ];
  });
}

export function parseLines(raw: unknown[]): PlanLine[] {
  return raw.flatMap((item): PlanLine[] => {
    if (!isRecord(item)) return [];
    const { id, x1, y1, x2, y2, width } = item;
    if (typeof id !== "string" || !num(x1) || !num(y1) || !num(x2) || !num(y2)) return [];
    return [{ id, x1, y1, x2, y2, width: num(width) && width > 0 ? width : 1 }];
  });
}
