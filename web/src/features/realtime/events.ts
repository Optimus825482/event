import { z } from "zod";

/**
 * Canlı güncelleme olay sözleşmesi. Bu dosya sunucuya bağımlı değildir; istemci
 * kancası da aynı türleri kullanır.
 *
 * Yük yalnızca kimlik taşır (tür, etkinlik kimliği, isteğe bağlı kayıt kimliği,
 * zaman) — kişisel veri asla taşınmaz. İstemci olayı aldığında veriyi yetki
 * denetimli normal sorgularla yeniden çeker.
 */

export const REALTIME_CHANNEL = "eventflow_events";

/** PostgreSQL NOTIFY yük sınırı 8000 bayttır; pay bırakılır. */
export const MAX_PAYLOAD_BYTES = 7900;

export const REALTIME_EVENT_TYPES = [
  "reservation.changed",
  "guest.checked_in",
  "table.updated",
  "stats.updated",
  "notification.created",
  "allocation.changed",
  "seats.changed",
  "order.paid",
  "sales.changed",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

/** `notifications.audience` ile aynı değerler. */
export const NOTIFICATION_AUDIENCES = ["all", "admin", "entertainment", "fnb", "casino"] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

// Kimlik: yalnızca harf, rakam, "-" ve "_" (e-posta, telefon, ad gibi değerler bu kalıba uymaz).
const recordId = z.string().regex(/^[A-Za-z0-9_-]+$/, "kimlik yalnızca harf, rakam, - ve _ içerebilir");
const at = z.iso.datetime();

const eventScoped = (type: Exclude<RealtimeEventType, "notification.created">) =>
  z.strictObject({ type: z.literal(type), eventId: z.uuid(), id: recordId.optional(), at });

export const realtimeEventSchema = z.union([
  eventScoped("reservation.changed"),
  eventScoped("guest.checked_in"),
  eventScoped("table.updated"),
  eventScoped("stats.updated"),
  eventScoped("allocation.changed"),
  eventScoped("seats.changed"),
  eventScoped("order.paid"),
  eventScoped("sales.changed"),
  z.strictObject({ type: z.literal("notification.created"), eventId: z.uuid(), id: recordId.optional(), at }),
  z.strictObject({
    type: z.literal("notification.created"),
    audience: z.enum(NOTIFICATION_AUDIENCES),
    id: recordId.optional(),
    at,
  }),
]);

/**
 * Yayılan olay. `notification.created` ya bir etkinliğe (`eventId`) ya da bir hedef
 * kitleye (`audience`) yöneliktir; kitleye yönelik olay, abonenin görebildiği kitleler arasında
 * olan (veya `audience: "all"`) akışlara gider (bkz. hub.ts).
 */
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** `publish` girdisi: `at` verilmezse yayın anında doldurulur. */
export type RealtimeEventInput = DistributiveOmit<RealtimeEvent, "at"> & { at?: string };

export class RealtimePayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtimePayloadError";
  }
}

/** Olayı doğrular ve NOTIFY yüküne çevirir; geçersiz veya büyük yükte `RealtimePayloadError`. */
export function encodeRealtimeEvent(input: RealtimeEventInput): string {
  const parsed = realtimeEventSchema.safeParse({ ...input, at: input.at ?? new Date().toISOString() });
  if (!parsed.success) {
    throw new RealtimePayloadError(`Geçersiz canlı güncelleme olayı: ${parsed.error.issues[0]?.message ?? ""}`);
  }
  const payload = JSON.stringify(parsed.data);
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes >= MAX_PAYLOAD_BYTES) {
    throw new RealtimePayloadError(`Canlı güncelleme yükü çok büyük: ${bytes} bayt (sınır ${MAX_PAYLOAD_BYTES})`);
  }
  return payload;
}

/** Gelen NOTIFY yükünü çözer; tanınmayan yük `null` döner. */
export function decodeRealtimeEvent(payload: string | undefined): RealtimeEvent | null {
  if (payload === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  const parsed = realtimeEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
