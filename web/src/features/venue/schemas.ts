import { z } from "zod";

/** Bir etkinlikte en çok kaç masa olabilir (eski düzenleyici 200 ile sınırlıyordu). */
export const MAX_TABLES = 500;
export const MAX_DECOR_ELEMENTS = 200;
export const MAX_TABLE_CAPACITY = 100;
export const LABEL_MAX = 20;
export const MIN_FLOOR = 1;
export const MAX_FLOOR = 9;
export const TABLE_SIZE_MIN = 8;
export const TABLE_SIZE_MAX = 400;

export const DECOR_KINDS = ["stage", "area", "wall", "label"] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export const TABLE_SHAPES = ["round", "rectangle", "square"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

export const DECOR_ICONS = ["none", "mic", "footprints", "utensils", "settings", "users", "box", "star"] as const;
export type DecorIcon = (typeof DECOR_ICONS)[number];
export const DECOR_FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type DecorFontSize = (typeof DECOR_FONT_SIZES)[number];
export const DECOR_FONT_FAMILIES = ["sans", "roboto", "playfair", "oswald"] as const;
export type DecorFontFamily = (typeof DECOR_FONT_FAMILIES)[number];
export const DECOR_TEXT_DIRECTIONS = ["horizontal", "vertical-down", "vertical-up"] as const;
export type DecorTextDirection = (typeof DECOR_TEXT_DIRECTIONS)[number];
export const DECOR_BORDER_MAX = 6;

const coordinate = z.number({ error: "Konum sayı olmalı" }).min(-100_000).max(100_000);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı");

/** Etiket karşılaştırması: baştaki/sondaki boşluk ve büyük/küçük harf yok sayılır. */
export function normalizeLabel(label: string): string {
  return label.trim().toLocaleLowerCase("tr");
}

export const tableInputSchema = z.object({
  id: z.uuid().optional(),
  label: z
    .string({ error: "Etiket gerekli" })
    .trim()
    .min(1, "Etiket gerekli")
    .max(LABEL_MAX, `Etiket en fazla ${LABEL_MAX} karakter olabilir`),
  capacity: z
    .number({ error: "Kapasite gerekli" })
    .int("Kapasite tam sayı olmalı")
    .min(1, "Kapasite en az 1 olmalı")
    .max(MAX_TABLE_CAPACITY, `Kapasite en fazla ${MAX_TABLE_CAPACITY} olabilir`),
  tableTypeId: z.uuid().nullable().default(null),
  x: coordinate,
  y: coordinate,
  rotation: z.number().min(-3600).max(3600).default(0),
  isLoca: z.boolean().default(false),
  isVip: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  /** Çizim boyutu (px); null = kapasiteden türetilir. */
  size: z.number({ error: "Boyut sayı olmalı" }).min(TABLE_SIZE_MIN, `Boyut en az ${TABLE_SIZE_MIN} olmalı`).max(TABLE_SIZE_MAX, `Boyut en fazla ${TABLE_SIZE_MAX} olabilir`).nullable().default(null),
  floor: z
    .number({ error: "Kat sayı olmalı" })
    .int("Kat tam sayı olmalı")
    .min(MIN_FLOOR, `Kat en az ${MIN_FLOOR} olmalı`)
    .max(MAX_FLOOR, `Kat en fazla ${MAX_FLOOR} olabilir`)
    .default(1),
  sortNumber: z
    .number({ error: "Sıra numarası sayı olmalı" })
    .int("Sıra numarası tam sayı olmalı")
    .min(0, "Sıra numarası negatif olamaz")
    .max(1_000_000, "Sıra numarası çok büyük")
    .nullable()
    .default(null),
});
export type TableInput = z.input<typeof tableInputSchema>;
export type ParsedTableInput = z.output<typeof tableInputSchema>;

export const decorElementSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(DECOR_KINDS),
  x: coordinate,
  y: coordinate,
  width: z.number().positive().max(20_000),
  height: z.number().positive().max(20_000),
  rotation: z.number().min(-3600).max(3600).default(0),
  label: z.string().trim().max(60, "Metin en fazla 60 karakter olabilir").default(""),
  color: hexColor.optional(),
  /** Çerçeve rengi ve kalınlığı (0 = çerçevesiz). */
  borderColor: hexColor.optional(),
  borderWidth: z.number().int().min(0).max(DECOR_BORDER_MAX).optional(),
  icon: z.enum(DECOR_ICONS).optional(),
  fontSize: z.enum(DECOR_FONT_SIZES).optional(),
  fontFamily: z.enum(DECOR_FONT_FAMILIES).optional(),
  textDirection: z.enum(DECOR_TEXT_DIRECTIONS).optional(),
  /** Fareyle üzerine gelince görünen açıklama (görünen metinden ayrı). */
  tooltip: z.string().trim().max(120, "Açıklama en fazla 120 karakter olabilir").optional(),
  /** Düzenleyicide sabitlenmiş (taşınmaz). */
  isPinned: z.boolean().optional(),
  floor: z.number().int().min(MIN_FLOOR).max(MAX_FLOOR).optional(),
});
export type DecorElement = z.output<typeof decorElementSchema>;

export const DEFAULT_CANVAS = { width: 1200, height: 800 } as const;

/** Ayırıcı çizgi paleti (ilk renk eski sistemin grup çizgisi kırmızısı) ve kalınlıkları (px). */
export const LINE_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a855f7", "#e2e8f0"] as const;
export const LINE_WIDTHS = [2, 4, 6, 10] as const;
export const LINE_WIDTH_MAX = 12;
export const MAX_LINES = 200;
/** Çizgi uçlarının tuval dışına taşabileceği en büyük pay (px). */
export const LINE_BOUNDS_TOLERANCE = 40;

/** Düz ayırıcı/sınır çizgisi (eski sistemdeki "grup çizgileri"). */
export const decorLineSchema = z.object({
  id: z.string().min(1).max(64),
  x1: coordinate,
  y1: coordinate,
  x2: coordinate,
  y2: coordinate,
  color: hexColor,
  width: z.number().int("Kalınlık tam sayı olmalı").min(1).max(LINE_WIDTH_MAX),
});
export type DecorLine = z.output<typeof decorLineSchema>;

/** Masa olmayan yerleşim öğeleri (`events.layout_decor`, şablonda `layoutData.decor`). */
export const decorSchema = z
  .object({
    width: z.number().int().min(200).max(20_000).default(DEFAULT_CANVAS.width),
    height: z.number().int().min(200).max(20_000).default(DEFAULT_CANVAS.height),
    elements: z.array(decorElementSchema).max(MAX_DECOR_ELEMENTS).default([]),
    /** Eski kayıtlarda yoktur; yoksa çizgi yok demektir. */
    lines: z.array(decorLineSchema).max(MAX_LINES, `En fazla ${MAX_LINES} çizgi olabilir`).optional(),
  })
  .superRefine((value, ctx) => {
    const t = LINE_BOUNDS_TOLERANCE;
    const inX = (v: number) => v >= -t && v <= value.width + t;
    const inY = (v: number) => v >= -t && v <= value.height + t;
    value.lines?.forEach((l, index) => {
      if (!inX(l.x1) || !inX(l.x2) || !inY(l.y1) || !inY(l.y2)) {
        ctx.addIssue({ code: "custom", path: ["lines", index], message: "Çizgi tuvalin dışında" });
      } else if (l.x1 === l.x2 && l.y1 === l.y2) {
        ctx.addIssue({ code: "custom", path: ["lines", index], message: "Çizginin uzunluğu sıfır olamaz" });
      }
    });
  });
export type Decor = z.output<typeof decorSchema>;
export type DecorInput = z.input<typeof decorSchema>;

export function emptyDecor(): Decor {
  return { width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height, elements: [] };
}

/** Kayıtlı JSON bozuksa ya da yoksa boş dekor döner (eski veriler için tolerans). */
export function parseDecor(raw: unknown): Decor {
  const parsed = decorSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  // Bozuk bir çizgi listesi sahne/alan gibi geçerli öğeleri de düşürmesin: çizgiler atılıp yeniden denenir.
  if (typeof raw === "object" && raw !== null && "lines" in raw) {
    const withoutLines = decorSchema.safeParse({ ...raw, lines: undefined });
    if (withoutLines.success) return withoutLines.data;
  }
  return emptyDecor();
}

export const saveLayoutSchema = z
  .object({
    eventId: z.uuid(),
    tables: z.array(tableInputSchema).max(MAX_TABLES, `En fazla ${MAX_TABLES} masa olabilir`),
    decor: decorSchema,
  })
  .superRefine((value, ctx) => {
    const labels = new Map<string, number>();
    const ids = new Set<string>();
    value.tables.forEach((table, index) => {
      const key = normalizeLabel(table.label);
      if (labels.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["tables", index, "label"],
          message: `"${table.label}" etiketi birden fazla masada kullanılıyor`,
        });
      }
      labels.set(key, index);
      if (table.id) {
        if (ids.has(table.id)) {
          ctx.addIssue({ code: "custom", path: ["tables", index, "id"], message: "Masa iki kez gönderildi" });
        }
        ids.add(table.id);
      }
    });
  });
export type SaveLayoutInput = z.input<typeof saveLayoutSchema>;

export const applyTemplateSchema = z.object({ eventId: z.uuid(), templateId: z.uuid() });
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

const templateName = z
  .string({ error: "Şablon adı gerekli" })
  .trim()
  .min(1, "Şablon adı gerekli")
  .max(120, "Şablon adı en fazla 120 karakter olabilir");
const templateDescription = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(1000, "Açıklama en fazla 1000 karakter olabilir").optional(),
);

export const saveAsTemplateSchema = z.object({
  eventId: z.uuid(),
  name: templateName,
  description: templateDescription,
  isPublic: z.boolean().default(false),
});
export type SaveAsTemplateInput = Omit<z.output<typeof saveAsTemplateSchema>, "isPublic"> & { isPublic?: boolean };

export const updateTemplateSchema = z.object({
  id: z.uuid(),
  name: templateName,
  description: templateDescription,
  isPublic: z.boolean().default(false),
});
export type UpdateTemplateInput = Omit<z.output<typeof updateTemplateSchema>, "isPublic"> & { isPublic?: boolean };

export const templateIdSchema = z.object({ id: z.uuid() });
export type TemplateIdInput = z.infer<typeof templateIdSchema>;

/** Şablondaki masa: kimliksiz (uygulanınca etkinliğe yeni satır olarak eklenir). */
export const templateTableSchema = tableInputSchema.omit({ id: true });
export type TemplateTable = z.output<typeof templateTableSchema>;

export const templateLayoutSchema = z.object({
  version: z.literal(1),
  tables: z.array(templateTableSchema).max(MAX_TABLES),
  decor: decorSchema,
});
export type TemplateLayout = z.output<typeof templateLayoutSchema>;

const tableTypeShape = {
  name: z.string({ error: "Ad gerekli" }).trim().min(1, "Ad gerekli").max(60, "Ad en fazla 60 karakter olabilir"),
  color: hexColor,
  shape: z.enum(TABLE_SHAPES, { error: "Geçerli bir şekil seçin" }),
  capacity: z.coerce
    .number({ error: "Kapasite gerekli" })
    .int("Kapasite tam sayı olmalı")
    .min(1, "Kapasite en az 1 olmalı")
    .max(MAX_TABLE_CAPACITY, `Kapasite en fazla ${MAX_TABLE_CAPACITY} olabilir`),
  basePrice: z.coerce
    .number({ error: "Fiyat sayı olmalı" })
    .min(0, "Fiyat negatif olamaz")
    .max(9_999_999_999, "Fiyat çok büyük"),
  minSpacing: z.coerce.number().int().min(0, "Aralık negatif olamaz").max(1000).default(50),
  isActive: z.boolean().default(true),
};

export const createTableTypeSchema = z.object(tableTypeShape);
export type CreateTableTypeInput = z.output<typeof createTableTypeSchema>;

export const updateTableTypeSchema = z.object({ id: z.uuid(), ...tableTypeShape });
export type UpdateTableTypeInput = z.output<typeof updateTableTypeSchema>;

export const tableTypeIdSchema = z.object({ id: z.uuid() });
