// Satış API v1 sözleşmesi. `satis/` bu dosyayı birebir kopyalar: yalnızca "zod" içe aktarılır.
import { z } from "zod";

export const SALES_ERROR_CODES = [
  "invalid",
  "unauthorized",
  "payment_declined",
  "event_not_found",
  "order_not_found",
  "sales_closed",
  "seats_unavailable",
  "leaves_single_seat",
  "whole_table_required",
  "table_not_sellable",
  "limit_exceeded",
  "price_missing",
  "hold_expired",
  "already_paid",
  "rate_limited",
  "payments_disabled",
  "sales_api_disabled",
] as const;
export type SalesErrorCode = (typeof SALES_ERROR_CODES)[number];

export const SALES_ERROR_STATUS: Readonly<Record<SalesErrorCode, number>> = {
  invalid: 400,
  unauthorized: 401,
  payment_declined: 402,
  event_not_found: 404,
  order_not_found: 404,
  sales_closed: 409,
  seats_unavailable: 409,
  leaves_single_seat: 409,
  whole_table_required: 409,
  table_not_sellable: 409,
  limit_exceeded: 409,
  price_missing: 409,
  hold_expired: 409,
  already_paid: 409,
  rate_limited: 429,
  payments_disabled: 503,
  sales_api_disabled: 503,
};

export const SALES_ERROR_MESSAGES: Readonly<Record<SalesErrorCode, string>> = {
  invalid: "İstek geçersiz",
  unauthorized: "Yetkisiz istek",
  payment_declined: "Ödeme reddedildi",
  event_not_found: "Etkinlik bulunamadı",
  order_not_found: "Sipariş bulunamadı",
  sales_closed: "Bu etkinlik için satış açık değil",
  seats_unavailable: "Seçilen masada yeterli boş sandalye yok",
  leaves_single_seat:
    "Bu adet masada tek boş sandalye bırakıyor; adedi değiştirin ya da kalan sandalyelerin tamamını alın",
  whole_table_required: "Bu masa yalnızca bütün olarak satılır",
  table_not_sellable: "Bu masa satışta değil",
  limit_exceeded: "Sipariş sınırı aşıldı",
  price_missing: "Bu masanın fiyatı henüz belirlenmedi",
  hold_expired: "Tutma süresi doldu",
  already_paid: "Ödenmiş sipariş iptal edilemez",
  rate_limited: "Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.",
  payments_disabled: "Ödeme şu anda kullanılamıyor",
  sales_api_disabled: "Satış API'si yapılandırılmamış",
};

export const DEMO_NOTICE = "DEMO - gerçek ödeme alınmadı";
export const MAX_ORDER_TABLES = 5;
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_SEAT_NO = 999;
export const SALES_CATEGORIES = ["standard", "premium", "vip"] as const;
export const SALE_STATES = ["open", "not_started", "ended", "closed"] as const;
export type SaleState = (typeof SALE_STATES)[number];
export const SALE_MODES = ["table", "seat"] as const;
export type SaleMode = (typeof SALE_MODES)[number];
export const SIGHTLINE_SETS = ["diamond"] as const;
export type SightlineSet = (typeof SIGHTLINE_SETS)[number];
export const IMAGE_PATH_PATTERN =
  /^(event|artist)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
/** Yalnızca hero (tanıtım) alanı: WebM video yolu. Diğer görsel alanları `IMAGE_PATH_PATTERN` ile sınırlıdır. */
export const HERO_VIDEO_PATH_PATTERN =
  /^event\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webm$/;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
// UUID'ler küçük harfe indirilir: büyük harfli yineleme (`clientKey`) aynı siparişi bulur.
const uuid = () => z.uuid().transform((s) => s.toLowerCase());
const categorySchema = z.enum(SALES_CATEGORIES);
const saleStateSchema = z.enum(SALE_STATES);

// --- İstek şemaları ---
export const createOrderBodySchema = z.strictObject({
  eventId: uuid(),
  items: z
    .array(
      z
        .strictObject({
          tableId: uuid(),
          quantity: z.number().int().min(1).max(50),
          seatNos: z.array(z.number().int().min(1).max(MAX_SEAT_NO)).min(1).max(50).optional(),
        })
        .refine(
          (v) => v.seatNos === undefined || (v.seatNos.length === v.quantity && new Set(v.seatNos).size === v.seatNos.length),
          "seatNos adetle eşit uzunlukta ve tekil olmalıdır",
        ),
    )
    .min(1)
    .max(20),
  clientKey: uuid(),
});
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export const payOrderBodySchema = z.strictObject({
  buyer: z.strictObject({
    firstName: trimmed(100),
    lastName: trimmed(100),
    email: z.email().max(254),
    phone: trimmed(32).optional(),
  }),
  acceptTerms: z.literal(true),
  payment: z.strictObject({
    provider: z.literal("demo"),
    action: z.enum(["approve", "decline"]),
  }),
});
export type PayOrderBody = z.infer<typeof payOrderBodySchema>;

export const lookupBodySchema = z.strictObject({
  pnr: trimmed(32),
  lastName: trimmed(100),
});
export type LookupBody = z.infer<typeof lookupBodySchema>;

// --- Yanıt şemaları ---
export const eventCardSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  artistName: z.string().nullable(),
  eventType: z.string().nullable(),
  currency: z.string(),
  minPrice: z.string().nullable(),
  saleState: saleStateSchema,
  coverImage: z.string().nullable(),
  artistImage: z.string().nullable(),
  isDemo: z.boolean(),
});
export type EventCard = z.infer<typeof eventCardSchema>;

export const eventsResponseSchema = z.strictObject({ events: z.array(eventCardSchema) });

export const planTablePublicSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  shape: z.enum(["round", "rectangle", "square"]),
  isLoca: z.boolean(),
  sellable: z.boolean(),
  category: categorySchema.nullable(),
  capacity: z.number(),
  seats: z.number().nullable(),
  seatNos: z.array(z.number()),
  wholeOnly: z.boolean(),
});
export type PlanTablePublic = z.infer<typeof planTablePublicSchema>;

export const eventDetailSchema = eventCardSchema.extend({
  description: z.string().nullable(),
  site: z.strictObject({
    heroImage: z.string().nullable(),
    summary: z.string().nullable(),
    doorsOpenAt: z.string().nullable(),
    ageLimit: z.string().nullable(),
    dressCode: z.string().nullable(),
    sightlineSet: z.enum(SIGHTLINE_SETS).nullable(),
  }),
  sale: z.strictObject({
    state: saleStateSchema,
    mode: z.enum(SALE_MODES),
    opensAt: z.string().nullable(),
    closesAt: z.string().nullable(),
    holdMinutes: z.number(),
    maxSeatsPerOrder: z.number(),
    blockSingleLeftover: z.boolean(),
    demo: z.boolean(),
  }),
  prices: z.array(z.strictObject({ category: categorySchema, label: z.string(), price: z.string() })),
  plan: z.strictObject({
    canvas: z.strictObject({ width: z.number(), height: z.number() }),
    tables: z.array(planTablePublicSchema),
    decor: z.array(z.unknown()),
    lines: z.array(z.unknown()),
  }),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;

export const availabilitySchema = z.strictObject({
  at: z.string(),
  tables: z.array(z.strictObject({ id: z.string(), free: z.number(), freeSeats: z.array(z.number()) })),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const orderResponseSchema = z.strictObject({
  orderId: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  startsAt: z.string(),
  status: z.enum(["pending", "paid", "expired"]),
  holdExpiresAt: z.string(),
  currency: z.string(),
  total: z.string(),
  isDemo: z.boolean(),
  pnr: z.string().nullable(),
  items: z.array(
    z.strictObject({
      tableId: z.string(),
      tableLabel: z.string(),
      category: categorySchema,
      quantity: z.number(),
      unitPrice: z.string(),
    }),
  ),
  tickets: z.array(
    z.strictObject({
      ticketId: z.string(),
      tableId: z.string(),
      tableLabel: z.string(),
      seatNo: z.number().nullable(),
      qrPayload: z.string(),
    }),
  ),
  orderToken: z.string(),
  demoNotice: z.string().nullable(),
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const lookupResponseSchema = z.strictObject({ orderToken: z.string() });

export const errorBodySchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
