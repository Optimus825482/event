import {
  type Decor,
  type DecorElement,
  type DecorFontFamily,
  type DecorFontSize,
  type DecorIcon,
  type DecorTextDirection,
  decorSchema,
  DECOR_BORDER_MAX,
  DECOR_FONT_FAMILIES,
  DECOR_FONT_SIZES,
  DECOR_ICONS,
  DECOR_TEXT_DIRECTIONS,
  DEFAULT_CANVAS,
  LABEL_MAX,
  MAX_DECOR_ELEMENTS,
  MAX_FLOOR,
  MIN_FLOOR,
  normalizeLabel,
  TABLE_SIZE_MAX,
  TABLE_SIZE_MIN,
} from "@/features/venue/schemas";
import { isRecord } from "./context";
import { uniqueName } from "./values";

/**
 * Eski `events."venueLayout"` JSON'unu çözer. İki biçim vardır:
 * - API'nin yazdığı yeni biçim: `placedTables[]` (+ `stageElements`, `drawnLines`, `dimensions`,
 *   `tablePlans`, `stageConfig`, `groupLines`),
 * - entity tipindeki eski biçim: `tables[]` (+ `walls`, `stage`, `dimensions`).
 * Bazı servisler yalnızca `tables`, bazıları `placedTables || tables` okur; burada ikisi de okunur
 * (ikisi birden varsa `placedTables` önce gelir, `tables` içinden yalnızca kimliği yeni olanlar eklenir).
 */

export type LayoutTable = {
  legacyId: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
  isVip: boolean;
  /** Eski `isLocked` (düzenleyicide sabitlenmiş). */
  isPinned: boolean;
  size: number | null;
  floor: number;
  /** Eski `tableNumber` sayısal ise. */
  sortNumber: number | null;
  typeRef: string | null;
  /** Rezervasyon eşlemesi için ek anahtarlar (masa numarası, loca adı, eski etiket). */
  aliases: string[];
};

export type LayoutIssue = { kind: string; legacyId?: string; detail: string };

export type ParsedLayout = {
  tables: LayoutTable[];
  decor: Decor;
  sourceKeys: Array<"placedTables" | "tables">;
  issues: LayoutIssue[];
  droppedKeys: string[];
  droppedTableProps: Record<string, number>;
  droppedDecorProps: Record<string, number>;
  /** Sınırlayıcı kutuya indirgenen çizgi/duvar sayısı (geometri kaybı). */
  convertedLines: number;
};

const TABLE_KEYS = new Set(["id", "label", "tableNumber", "locaName", "type", "capacity", "x", "y", "rotation", "isLoca", "isVip", "isLocked", "size", "floor"]);
const DECOR_KEYS = new Set([
  "id", "type", "x", "y", "width", "height", "label", "displayText", "color", "rotation",
  "borderColor", "borderWidth", "iconId", "fontSize", "fontFamily", "textDirection", "isLocked", "floor",
]);
const LAYOUT_KEYS = new Set(["placedTables", "tables", "stageElements", "stage", "walls", "drawnLines", "dimensions"]);
const COORD = 100_000;
const DEFAULT_CAPACITY = 8;
/** Eski düzenleyicide `size` yoksa varsayılan masa boyutu (px, `DEFAULT_TABLE_SIZE`). */
const LEGACY_DEFAULT_SIZE = 40;
const MAX_CAPACITY = 100;
const HEX = /^#[0-9a-fA-F]{6}$/;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

const clampCoord = (v: number) => Math.min(COORD, Math.max(-COORD, v));

function countExtraKeys(item: Record<string, unknown>, known: Set<string>, into: Record<string, number>): void {
  for (const [key, value] of Object.entries(item)) {
    if (!known.has(key) && value !== undefined && value !== null && value !== "") into[key] = (into[key] ?? 0) + 1;
  }
}

function tableFrom(
  item: Record<string, unknown>,
  index: number,
  issues: LayoutIssue[],
): { table: Omit<LayoutTable, "label">; rawLabel: string } {
  const legacyId = text(item.id) ?? `#${index}`;
  if (text(item.id) === null) issues.push({ kind: "table_without_id", legacyId, detail: `sıra ${index}` });
  const typeRef = text(item.type);
  const isLoca = item.isLoca === true || typeRef?.toLowerCase() === "loca";
  const locaName = text(item.locaName);
  const tableNumber = text(item.tableNumber);
  const label = text(item.label);
  // Şablon dönüştürücüsüyle (template-layout.ts) aynı öncelik: loca adı → masa numarası → etiket.
  const rawLabel = (isLoca && locaName) || tableNumber || label || `M${index + 1}`;
  const aliases = [locaName, tableNumber, label, locaName ? `LOCA ${locaName}` : null, tableNumber ? `MASA ${tableNumber}` : null]
    .filter((v): v is string => v !== null);
  const rawCapacity = num(item.capacity);
  let capacity = DEFAULT_CAPACITY;
  if (rawCapacity !== null && rawCapacity >= 1) capacity = Math.min(MAX_CAPACITY, Math.round(rawCapacity));
  if (rawCapacity === null || capacity !== rawCapacity) {
    issues.push({ kind: "capacity_adjusted", legacyId, detail: `${rawCapacity ?? "yok"} → ${capacity}` });
  }
  const x = num(item.x);
  const y = num(item.y);
  if (x === null || y === null) issues.push({ kind: "position_missing", legacyId, detail: "x/y yok → 0" });
  const rawSize = num(item.size);
  const legacySize = rawSize !== null && rawSize > 0 ? rawSize : null;
  const size = legacySize === null ? null : Math.min(TABLE_SIZE_MAX, Math.max(TABLE_SIZE_MIN, legacySize));
  // Eski sistemde x/y, `size` px'lik kutunun sol-üst köşesidir; yeni düzenleyici merkezi kullanır.
  const half = (legacySize ?? LEGACY_DEFAULT_SIZE) / 2;
  const rawFloor = num(item.floor);
  let floor = MIN_FLOOR;
  if (rawFloor !== null) {
    floor = Math.min(MAX_FLOOR, Math.max(MIN_FLOOR, Math.round(rawFloor)));
    if (floor !== rawFloor) issues.push({ kind: "floor_adjusted", legacyId, detail: `${rawFloor} → ${floor}` });
  }
  const rawNumber = num(item.tableNumber);
  const table = {
    legacyId,
    capacity,
    x: clampCoord(x === null ? 0 : x + half),
    y: clampCoord(y === null ? 0 : y + half),
    rotation: Math.min(3600, Math.max(-3600, num(item.rotation) ?? 0)),
    isLoca,
    isVip: item.isVip === true,
    isPinned: item.isLocked === true,
    size,
    floor,
    sortNumber: rawNumber !== null && Number.isInteger(rawNumber) && rawNumber >= 0 && rawNumber <= 1_000_000 ? rawNumber : null,
    typeRef,
    aliases,
  };
  return { table, rawLabel };
}

function pointsBox(points: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!Array.isArray(points)) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  points.forEach((p, i) => {
    if (isRecord(p)) {
      const px = num(p.x);
      const py = num(p.y);
      if (px !== null && py !== null) {
        xs.push(px);
        ys.push(py);
      }
    } else {
      const v = num(p);
      if (v !== null) (i % 2 === 0 ? xs : ys).push(v);
    }
  });
  if (xs.length === 0 || ys.length === 0) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function decorKind(type: string | null): DecorElement["kind"] {
  const t = (type ?? "").toLowerCase();
  if (t === "stage") return "stage";
  if (t === "wall") return "wall";
  if (t === "label" || t === "text") return "label";
  return "area";
}

/** Eski sahne/alan stil anahtarlarından yeni `decorElementSchema` alanlarını çıkarır (geçersiz değerler atlanır). */
function decorStyleFrom(item: Record<string, unknown>, displayLabel: string): Partial<DecorElement> {
  const style: Partial<DecorElement> = {};
  const borderColor = text(item.borderColor);
  if (borderColor && HEX.test(borderColor)) style.borderColor = borderColor;
  const borderWidth = num(item.borderWidth);
  if (borderWidth !== null) style.borderWidth = Math.min(DECOR_BORDER_MAX, Math.max(0, Math.round(borderWidth)));
  const icon = text(item.iconId);
  if (icon && (DECOR_ICONS as readonly string[]).includes(icon) && icon !== "none") style.icon = icon as DecorIcon;
  const size = text(item.fontSize);
  if (size && (DECOR_FONT_SIZES as readonly string[]).includes(size)) style.fontSize = size as DecorFontSize;
  const family = text(item.fontFamily);
  if (family && (DECOR_FONT_FAMILIES as readonly string[]).includes(family)) style.fontFamily = family as DecorFontFamily;
  const direction = text(item.textDirection);
  if (direction && (DECOR_TEXT_DIRECTIONS as readonly string[]).includes(direction)) {
    style.textDirection = direction as DecorTextDirection;
  }
  // Eski sistemde `label` hover açıklamasıdır, `displayText` görünen metindir.
  const tooltip = text(item.label);
  if (text(item.displayText) !== null && tooltip !== null && tooltip !== displayLabel) style.tooltip = tooltip.slice(0, 120);
  if (item.isLocked === true) style.isPinned = true;
  const floor = num(item.floor);
  if (floor !== null) style.floor = Math.min(MAX_FLOOR, Math.max(MIN_FLOOR, Math.round(floor)));
  return style;
}

function buildDecor(raw: Record<string, unknown>, issues: LayoutIssue[], dropped: Record<string, number>): Decor {
  const elements: DecorElement[] = [];
  const push = (el: DecorElement) => elements.push(el);
  const stageElements = Array.isArray(raw.stageElements) ? raw.stageElements : [];
  stageElements.forEach((item, i) => {
    if (!isRecord(item)) return;
    countExtraKeys(item, DECOR_KEYS, dropped);
    const x = num(item.x);
    const y = num(item.y);
    const w = num(item.width);
    const h = num(item.height);
    const id = (text(item.id) ?? `legacy-stage-${i}`).slice(0, 64);
    if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) {
      issues.push({ kind: "decor_skipped", legacyId: id, detail: "konum/boyut geçersiz" });
      return;
    }
    const color = text(item.color);
    const displayLabel = (text(item.displayText) ?? text(item.label) ?? "").slice(0, 60);
    push({
      id,
      kind: decorKind(text(item.type)),
      x: clampCoord(x),
      y: clampCoord(y),
      width: Math.min(20_000, w),
      height: Math.min(20_000, h),
      rotation: Math.min(3600, Math.max(-3600, num(item.rotation) ?? 0)),
      label: displayLabel,
      ...(color && HEX.test(color) ? { color } : {}),
      ...decorStyleFrom(item, displayLabel),
    });
  });
  if (isRecord(raw.stage)) {
    const s = raw.stage;
    const [x, y, w, h] = [num(s.x), num(s.y), num(s.width), num(s.height)];
    if (x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0) {
      push({ id: "legacy-stage", kind: "stage", x: clampCoord(x), y: clampCoord(y), width: Math.min(20_000, w), height: Math.min(20_000, h), rotation: 0, label: "Sahne" });
    } else issues.push({ kind: "decor_skipped", legacyId: "stage", detail: "sahne konumu/boyutu geçersiz" });
  }
  const lines = [
    ...(Array.isArray(raw.walls) ? raw.walls.map((v) => ["wall", v] as const) : []),
    ...(Array.isArray(raw.drawnLines) ? raw.drawnLines.map((v) => ["line", v] as const) : []),
  ];
  lines.forEach(([source, item], i) => {
    if (!isRecord(item)) return;
    const box = pointsBox(item.points);
    const id = (text(item.id) ?? `legacy-${source}-${i}`).slice(0, 64);
    if (!box) {
      issues.push({ kind: "decor_skipped", legacyId: id, detail: `${source}: nokta yok` });
      return;
    }
    const stroke = Math.max(1, num(item.width) ?? 4);
    const color = text(item.color);
    // Çoklu nokta çizgisi sınırlayıcı kutuya indirgenir (bkz. şema boşlukları).
    push({
      id,
      kind: "wall",
      x: clampCoord(box.x),
      y: clampCoord(box.y),
      width: Math.min(20_000, Math.max(stroke, box.w)),
      height: Math.min(20_000, Math.max(stroke, box.h)),
      rotation: 0,
      label: "",
      ...(color && HEX.test(color) ? { color } : {}),
    });
  });
  if (elements.length > MAX_DECOR_ELEMENTS) {
    issues.push({ kind: "decor_truncated", detail: `${elements.length} öğe → ${MAX_DECOR_ELEMENTS}` });
    elements.length = MAX_DECOR_ELEMENTS;
  }
  const dims = isRecord(raw.dimensions) ? raw.dimensions : {};
  const dim = (v: unknown, fallback: number) => Math.min(20_000, Math.max(200, Math.round(num(v) ?? fallback)));
  return decorSchema.parse({ width: dim(dims.width, DEFAULT_CANVAS.width), height: dim(dims.height, DEFAULT_CANVAS.height), elements });
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

export function parseLayout(raw: unknown): ParsedLayout {
  const issues: LayoutIssue[] = [];
  const droppedTableProps: Record<string, number> = {};
  const droppedDecorProps: Record<string, number> = {};
  const layout = isRecord(raw) ? raw : {};
  if (raw !== null && raw !== undefined && !isRecord(raw)) issues.push({ kind: "layout_not_object", detail: typeof raw });
  const sourceKeys: ParsedLayout["sourceKeys"] = [];
  const items: Record<string, unknown>[] = [];
  for (const key of ["placedTables", "tables"] as const) {
    const list = layout[key];
    if (!Array.isArray(list)) continue;
    sourceKeys.push(key);
    list.forEach((item) => {
      if (isRecord(item)) items.push(item);
      else issues.push({ kind: "table_not_object", detail: `${key} içinde nesne olmayan öğe` });
    });
  }
  if (sourceKeys.length === 2) issues.push({ kind: "both_layout_keys", detail: "placedTables ve tables birlikte; kimliğe göre birleştirildi" });

  const seenIds = new Set<string>();
  const taken = new Set<string>();
  const tables: LayoutTable[] = [];
  items.forEach((item, index) => {
    countExtraKeys(item, TABLE_KEYS, droppedTableProps);
    const { table: t, rawLabel } = tableFrom(item, index, issues);
    if (seenIds.has(t.legacyId)) {
      if (sourceKeys.length === 2) return; // aynı masa iki biçimde: placedTables kazanır
      issues.push({ kind: "duplicate_table_id", legacyId: t.legacyId, detail: "ikinci kopya atlandı" });
      return;
    }
    seenIds.add(t.legacyId);
    const label = uniqueName(rawLabel, taken, normalizeLabel, LABEL_MAX);
    if (label !== rawLabel) issues.push({ kind: "label_renamed", legacyId: t.legacyId, detail: `"${rawLabel}" → "${label}"` });
    tables.push({ ...t, label });
  });

  const droppedKeys = Object.entries(layout)
    .filter(([key, value]) => !LAYOUT_KEYS.has(key) && hasContent(value))
    .map(([key]) => key)
    .sort();
  const decor = buildDecor(layout, issues, droppedDecorProps);
  const convertedLines = [layout.walls, layout.drawnLines].reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  return { tables, decor, sourceKeys, issues, droppedKeys, droppedTableProps, droppedDecorProps, convertedLines };
}
