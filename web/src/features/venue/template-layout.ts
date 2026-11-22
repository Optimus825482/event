import { z } from "zod";
import {
  DEFAULT_CANVAS,
  LABEL_MAX,
  MAX_TABLE_CAPACITY,
  decorSchema,
  emptyDecor,
  templateLayoutSchema,
  type Decor,
  type DecorElement,
  type TemplateLayout,
  type TemplateTable,
} from "./schemas";

// Eski sistemin `layoutData` biçimi: { placedTables, stageElements, dimensions }.
const legacyTableSchema = z.object({
  tableNumber: z.union([z.number(), z.string()]).optional(),
  locaName: z.string().optional(),
  capacity: z.number().optional(),
  x: z.number(),
  y: z.number(),
  isLoca: z.boolean().optional(),
});
const legacyStageSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  label: z.string().optional(),
  color: z.string().optional(),
});
const legacyLayoutSchema = z.object({
  placedTables: z.array(z.unknown()).optional(),
  stageElements: z.array(z.unknown()).optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
});

function clampCapacity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 8;
  return Math.min(MAX_TABLE_CAPACITY, Math.max(1, Math.round(value)));
}

function fromLegacy(raw: z.infer<typeof legacyLayoutSchema>): TemplateLayout {
  const tables: TemplateTable[] = [];
  const used = new Set<string>();
  (raw.placedTables ?? []).forEach((item, index) => {
    const parsed = legacyTableSchema.safeParse(item);
    if (!parsed.success) return;
    const t = parsed.data;
    let label = (t.isLoca && t.locaName ? t.locaName : String(t.tableNumber ?? index + 1)).trim().slice(0, LABEL_MAX);
    if (label === "" || used.has(label.toLocaleLowerCase("tr"))) label = `M${index + 1}`;
    used.add(label.toLocaleLowerCase("tr"));
    tables.push({
      label,
      capacity: clampCapacity(t.capacity),
      tableTypeId: null,
      x: t.x,
      y: t.y,
      rotation: 0,
      isLoca: t.isLoca ?? false,
    });
  });
  const elements: DecorElement[] = [];
  (raw.stageElements ?? []).forEach((item, index) => {
    const parsed = legacyStageSchema.safeParse(item);
    if (!parsed.success) return;
    const s = parsed.data;
    const color = s.color && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : undefined;
    elements.push({
      id: s.id ?? `legacy-${index}`,
      kind: s.type === "area" ? "area" : "stage",
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: 0,
      label: (s.label ?? "").slice(0, 60),
      ...(color ? { color } : {}),
    });
  });
  const decor: Decor = decorSchema.safeParse({
    width: Math.round(raw.dimensions?.width ?? DEFAULT_CANVAS.width),
    height: Math.round(raw.dimensions?.height ?? DEFAULT_CANVAS.height),
    elements,
  }).data ?? { ...emptyDecor(), elements };
  return { version: 1, tables, decor };
}

/**
 * Şablon `layoutData` JSON'unu okur. Yeni biçim (`version: 1`) doğrudan, eski sistemin
 * `placedTables`/`stageElements` biçimi dönüştürülerek okunur; ikisi de değilse boş yerleşim.
 */
export function parseTemplateLayout(raw: unknown): TemplateLayout {
  const current = templateLayoutSchema.safeParse(raw);
  if (current.success) return current.data;
  const legacy = legacyLayoutSchema.safeParse(raw);
  if (legacy.success && (legacy.data.placedTables || legacy.data.stageElements)) return fromLegacy(legacy.data);
  return { version: 1, tables: [], decor: emptyDecor() };
}
