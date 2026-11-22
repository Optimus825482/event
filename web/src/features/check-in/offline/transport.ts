import { z } from "zod";
import type { BatchOutcome, ItemResult, QueueItem } from "./queue-core";

const successSchema = z.object({
  outcome: z.enum(["checked_in", "already_checked_in"]),
  reservationId: z.string(),
  eventId: z.string(),
  guestName: z.string().nullable(),
  guestCount: z.number(),
  tableId: z.string(),
  tableLabel: z.string(),
  checkedInAt: z.string(),
  checkedInBy: z.object({ id: z.string(), username: z.string() }).nullable(),
});

const itemResultSchema = z.union([
  z.object({ ok: z.literal(true), data: successSchema }),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string() }),
]);

const batchBodySchema = z.object({
  results: z.array(z.object({ idempotencyKey: z.string().nullable(), result: itemResultSchema })),
});

const errorBodySchema = z.object({ message: z.string() });

export const CHECK_IN_ENDPOINT = "/api/check-in";
const REQUEST_TIMEOUT_MS = 20_000;

async function rejectedMessage(response: Response): Promise<string> {
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.message;
  } catch {
    // gövde JSON değil: genel mesaj
  }
  return `İstek reddedildi (${response.status})`;
}

/**
 * Bir grup kuyruk öğesini `POST /api/check-in` ucuna tek istekte gönderir ve sonucu kuyruğun
 * anlayacağı bir çıktıya çevirir. Yalnızca KESİN bilinen durumlar kalıcıdır; anlaşılamayan her
 * şey (ağ, 5xx, JSON olmayan 200 — örn. gezgin portal sayfası) yeniden denenebilir sayılır.
 */
export async function sendBatch(items: readonly QueueItem[], fetchImpl: typeof fetch = fetch): Promise<BatchOutcome> {
  const body = {
    // Sunucu, oturumdaki kullanıcı bu kimlikle uyuşmuyorsa isteği reddeder (başka oturumda gönderim olmaz).
    ownerId: items[0]?.ownerId ?? null,
    items: items.map((i) => ({
      eventId: i.eventId,
      idempotencyKey: i.idempotencyKey,
      clientTimestamp: i.clientTimestamp,
      ...i.target,
    })),
  };
  let response: Response;
  try {
    response = await fetchImpl(CHECK_IN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      // Asılı kalan bağlantı boşaltmayı sonsuza dek tutmasın; zaman aşımı ağ hatası sayılır
      // ve aynı anahtarla yeniden denenir.
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        : {}),
    });
  } catch {
    return { kind: "network" };
  }
  if (response.type === "opaqueredirect") return { kind: "network" };
  const { status } = response;
  if (status === 401) return { kind: "unauthenticated" };
  if (status >= 500 || status === 408 || status === 429) return { kind: "retry", status };
  if (status !== 200) return { kind: "rejected", status, message: await rejectedMessage(response) };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { kind: "retry", status };
  }
  const parsed = batchBodySchema.safeParse(json);
  if (!parsed.success) return { kind: "retry", status };
  const results = parsed.data.results.map((r) => ({
    idempotencyKey: r.idempotencyKey,
    result: r.result as ItemResult,
  }));
  return { kind: "results", results };
}
