/**
 * Şablon önizlemesinin geometrisi (saf, tarayıcıdan bağımsız). Masa x/y değerleri MERKEZdir;
 * dekor öğelerinin x/y değerleri sol üst köşedir. Tanınmayan ek alanlar yok sayılır.
 */

export type PreviewTableInput = {
  label: string;
  capacity: number;
  x: number;
  y: number;
  isLoca: boolean;
  isVip?: boolean;
};

export type PreviewElementInput = {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  color?: string;
};

export type PreviewLayoutInput = {
  tables: readonly PreviewTableInput[];
  decor: { width: number; height: number; elements: readonly PreviewElementInput[] };
};

export type PreviewTableKind = "standard" | "vip" | "loca";

export type PreviewTable = {
  key: string;
  label: string;
  kind: PreviewTableKind;
  /** Merkez. */
  cx: number;
  cy: number;
  /** Yuvarlak masada yarıçap; locada yarı genişlik. */
  rx: number;
  /** Locada yarı yükseklik (yuvarlak masada `rx` ile aynı). */
  ry: number;
};

export type PreviewElement = {
  key: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  color: string | null;
};

export type TemplatePreviewModel = {
  viewBox: { x: number; y: number; width: number; height: number };
  tables: PreviewTable[];
  elements: PreviewElement[];
  /** Masa ve dekor yok. */
  empty: boolean;
};

const MIN_RADIUS = 24;
const MAX_RADIUS = 48;
const PADDING = 40;

/** Kapasiteyle büyüyen, sınırlı masa yarıçapı. */
export function tableRadius(capacity: number): number {
  const base = 22 + (Number.isFinite(capacity) ? capacity : 0) * 2;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, base));
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function buildTemplatePreview(layout: PreviewLayoutInput): TemplatePreviewModel {
  const tables: PreviewTable[] = layout.tables.map((t, index) => {
    const r = tableRadius(t.capacity);
    const kind: PreviewTableKind = t.isLoca ? "loca" : t.isVip === true ? "vip" : "standard";
    return {
      key: `t${index}`,
      label: t.label,
      kind,
      cx: finite(t.x, 0),
      cy: finite(t.y, 0),
      rx: kind === "loca" ? r * 1.5 : r,
      ry: kind === "loca" ? r * 0.9 : r,
    };
  });
  const elements: PreviewElement[] = layout.decor.elements.map((e, index) => ({
    key: `e${index}`,
    kind: e.kind,
    x: finite(e.x, 0),
    y: finite(e.y, 0),
    width: Math.max(1, finite(e.width, 1)),
    height: Math.max(1, finite(e.height, 1)),
    rotation: finite(e.rotation, 0),
    label: e.label,
    color: e.color ?? null,
  }));

  // Tuval her zaman görünür; taşan öğeler görünümü genişletir.
  let minX = 0;
  let minY = 0;
  let maxX = Math.max(1, layout.decor.width);
  let maxY = Math.max(1, layout.decor.height);
  for (const t of tables) {
    minX = Math.min(minX, t.cx - t.rx);
    minY = Math.min(minY, t.cy - t.ry);
    maxX = Math.max(maxX, t.cx + t.rx);
    maxY = Math.max(maxY, t.cy + t.ry);
  }
  for (const e of elements) {
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }

  return {
    viewBox: {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2,
    },
    tables,
    elements,
    empty: tables.length === 0 && elements.length === 0,
  };
}
