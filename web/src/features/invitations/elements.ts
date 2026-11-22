import { z } from "zod";

export const INVITATION_SIZES = {
  A5: { width: 559, height: 794, label: "A5 (148x210mm)" },
  A6: { width: 397, height: 559, label: "A6 (105x148mm)" },
  SQUARE: { width: 600, height: 600, label: "Kare (600x600)" },
  CUSTOM: { width: 600, height: 800, label: "Özel" },
} as const;

export const SIZE_KEYS = ["A5", "A6", "SQUARE", "CUSTOM"] as const;
export type InvitationSizeKey = (typeof SIZE_KEYS)[number];

export const ELEMENT_TYPES = [
  "text",
  "image",
  "qrcode",
  "guestName",
  "eventName",
  "eventDate",
  "eventTime",
  "eventLocation",
  "eventDescription",
  "logo",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Yüklenen görüntü yolu (`saveImage` çıktısı); uzak adres ve veri URL'si kabul edilmez. */
export const UPLOAD_PATH = /^(invitation|logo|event)\/[0-9a-f-]{36}\.webp$/;

// Satır içi stile girecek değerler: `url(...)` gibi harici istek tetikleyen yapılar reddedilir.
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|[a-zA-Z]{3,30})$/;
const GRADIENT = /^(linear|radial)-gradient\([#0-9a-zA-Z\s.,%()-]{1,300}\)$/;
const FONT_FAMILY = /^[\p{L}\d\s,'"-]{1,80}$/u;

export const cssColorSchema = z.string().trim().regex(COLOR, "Geçerli bir renk girin");
export const cssGradientSchema = z.string().trim().regex(GRADIENT, "Geçerli bir geçiş girin");
export const uploadPathSchema = z.string().regex(UPLOAD_PATH, "Geçersiz görüntü yolu");

const coord = z.number().finite().min(-5000).max(5000);
const length = z.number().finite().min(1).max(5000);

export const invitationElementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(ELEMENT_TYPES),
  x: coord,
  y: coord,
  width: length,
  height: length,
  rotation: z.number().finite().min(-360).max(360).optional(),
  content: z.string().max(2000).optional(),
  fontSize: z.number().finite().min(1).max(300).optional(),
  fontFamily: z.string().regex(FONT_FAMILY).optional(),
  fontWeight: z.string().max(10).optional(),
  color: cssColorSchema.optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  imageUrl: uploadPathSchema.optional(),
  objectFit: z.enum(["contain", "cover", "fill"]).optional(),
  borderRadius: z.number().finite().min(0).max(1000).optional(),
  backgroundColor: cssColorSchema.optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  zIndex: z.number().int().min(0).max(1000).optional(),
});
export type InvitationElement = z.infer<typeof invitationElementSchema>;

export const invitationElementsSchema = z.array(invitationElementSchema).max(200);

/** Saklı JSON'dan yalnızca geçerli öğeleri alır (eski/bozuk veri sayfayı bozmaz). */
export function parseStoredElements(raw: unknown): InvitationElement[] {
  if (!Array.isArray(raw)) return [];
  const out: InvitationElement[] = [];
  for (const item of raw) {
    const parsed = invitationElementSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

const PADDING = 10;
const MIN_ELEMENT_SIZE = 20;
const MIN_FONT = 8;
const MAX_FONT = 72;
const VALID_WEIGHTS = new Set(["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"]);

function clampAxis(pos: number, size: number, canvas: number): { pos: number; size: number } {
  let p = pos < 0 ? PADDING : pos;
  let s = size;
  if (p + s > canvas) {
    if (s > canvas - PADDING * 2) {
      s = canvas - PADDING * 2;
      p = PADDING;
    } else {
      p = canvas - s - PADDING;
    }
  }
  return { pos: p, size: s };
}

/** Eski "akıllı düzeltme": tuval sınırı, en az boyut, yazı boyutu ve ortalama (kaydetmeden önce). */
export function smartFixElements(elements: InvitationElement[], canvasWidth: number, canvasHeight: number): InvitationElement[] {
  return elements.map((element) => {
    const fixed = { ...element };
    fixed.width = Math.max(fixed.width, MIN_ELEMENT_SIZE);
    fixed.height = Math.max(fixed.height, MIN_ELEMENT_SIZE);

    const ax = clampAxis(fixed.x, fixed.width, canvasWidth);
    fixed.x = ax.pos;
    fixed.width = ax.size;
    const ay = clampAxis(fixed.y, fixed.height, canvasHeight);
    fixed.y = ay.pos;
    fixed.height = ay.size;

    if (fixed.fontSize !== undefined) {
      fixed.fontSize = Math.min(Math.max(fixed.fontSize, MIN_FONT), MAX_FONT);
      const maxForHeight = Math.floor(fixed.height * 0.8);
      if (fixed.fontSize > maxForHeight && maxForHeight >= MIN_FONT) fixed.fontSize = maxForHeight;
    }
    if (fixed.fontWeight && !VALID_WEIGHTS.has(fixed.fontWeight)) fixed.fontWeight = "normal";
    fixed.zIndex = fixed.zIndex === undefined || fixed.zIndex < 0 ? 0 : fixed.zIndex;

    if (fixed.textAlign === "center" && fixed.width < canvasWidth - PADDING * 2) {
      const centerX = (canvasWidth - fixed.width) / 2;
      if (Math.abs(fixed.x - centerX) < 50) fixed.x = centerX;
    }
    return fixed;
  });
}

export type FieldValues = Record<string, string>;

/** `{{guestName}}` gibi yer tutucuları doldurur; bilinmeyen anahtar boş metin olur. */
export function fillPlaceholders(content: string, fields: FieldValues): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => fields[key] ?? "");
}

const FIELD_OF_TYPE: Partial<Record<ElementType, string>> = {
  guestName: "guestName",
  eventName: "eventName",
  eventDate: "eventDate",
  eventTime: "eventTime",
  eventLocation: "eventLocation",
  eventDescription: "eventDescription",
};

/** Alan/metin öğelerinin gösterilecek yazısı; diğer türler için `content` değişmez. */
export function withFieldValues(element: InvitationElement, fields: FieldValues): InvitationElement {
  const fieldKey = FIELD_OF_TYPE[element.type];
  if (fieldKey) return { ...element, content: element.content ? fillPlaceholders(element.content, fields) : (fields[fieldKey] ?? "") };
  if (element.type === "text") return { ...element, content: fillPlaceholders(element.content ?? "", fields) };
  return element;
}

const INTER = "Inter";

function textEl(
  id: string,
  type: ElementType,
  y: number,
  height: number,
  content: string,
  extra: Partial<InvitationElement>,
  zIndex: number,
): InvitationElement {
  return { id, type, x: 40, y, width: 479, height, fontFamily: INTER, textAlign: "center", content, zIndex, ...extra };
}

/** Sistem şablonu "Standart Davetiye" (A5); eski varsayılan şablonun karşılığı. */
export const DEFAULT_TEMPLATE_ELEMENTS: InvitationElement[] = [
  { id: "decoration-top", type: "text", x: 80, y: 40, width: 399, height: 20, backgroundColor: "#3B82F6", content: "", zIndex: 1 },
  { id: "logo", type: "logo", x: 229, y: 70, width: 100, height: 100, objectFit: "contain", zIndex: 2 },
  textEl("event-name", "eventName", 180, 60, "{{eventName}}", { fontSize: 32, fontWeight: "bold", color: "#1F2937" }, 3),
  textEl("event-description", "eventDescription", 250, 80, "{{eventDescription}}", { fontSize: 14, color: "#6B7280" }, 4),
  textEl("event-date", "eventDate", 360, 40, "{{eventDate}}", { fontSize: 18, fontWeight: "600", color: "#374151" }, 5),
  textEl("event-time", "eventTime", 410, 30, "{{eventTime}}", { fontSize: 16, color: "#6B7280" }, 6),
  textEl("event-location", "eventLocation", 450, 30, "{{eventLocation}}", { fontSize: 14, color: "#6B7280" }, 7),
  { id: "divider", type: "text", x: 180, y: 500, width: 199, height: 20, backgroundColor: "#E5E7EB", content: "", zIndex: 8 },
  textEl("guest-name", "guestName", 530, 40, "{{guestName}}", { fontSize: 20, fontWeight: "600", color: "#1F2937" }, 9),
  textEl("table-info", "text", 575, 30, "Masa: {{tableLabel}}", { fontSize: 16, color: "#3B82F6" }, 10),
  { id: "qrcode", type: "qrcode", x: 204, y: 620, width: 150, height: 150, zIndex: 11 },
];

export const DEFAULT_TEMPLATE_NAME = "Standart Davetiye";
