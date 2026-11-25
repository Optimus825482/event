import { logError } from "@/lib/log";
import { visibleAudiences } from "@/features/notifications/service";
import { authorizeStream } from "./access";
import { subscribe, type StreamMessage } from "./hub";
import { ensureListening } from "./listener";

export const MAX_STREAMS_PER_USER = 5;
export const HEARTBEAT_MS = 25_000;
/** İstemci kopunca EventSource'un yeniden denemeden önce beklediği süre. */
export const RETRY_MS = 3_000;
/** Okumayan (yavaş) istemcide kuyrukta bekleyebilecek en çok çerçeve; aşılırsa akış kapatılır. */
const MAX_QUEUED_FRAMES = 256;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
} as const;

const SLOTS_KEY = Symbol.for("eventflow.realtime.slots");
type GlobalWithSlots = typeof globalThis & { [SLOTS_KEY]?: Map<string, number> };

function slots(): Map<string, number> {
  const g = globalThis as GlobalWithSlots;
  g[SLOTS_KEY] ??= new Map();
  return g[SLOTS_KEY];
}

/** Kullanıcı için akış yuvası ayırır; sınır doluysa `null`. Dönen işlev bir kez serbest bırakır. */
function acquireSlot(userId: string): (() => void) | null {
  const map = slots();
  const used = map.get(userId) ?? 0;
  if (used >= MAX_STREAMS_PER_USER) return null;
  map.set(userId, used + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = (map.get(userId) ?? 1) - 1;
    if (current <= 0) map.delete(userId);
    else map.set(userId, current);
  };
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function frameOf(message: StreamMessage): string {
  if (message.kind === "resync") return "event: resync\ndata: {}\n\n";
  return `event: ${message.event.type}\ndata: ${JSON.stringify(message.event)}\n\n`;
}

/**
 * `GET /api/events/[eventId]/stream` gövdesi: yetkiyi denetler, paylaşımlı LISTEN
 * bağlantısını hazırlar ve etkinliğin olaylarını SSE olarak akıtır. İstek iptal
 * edilince ya da akış okuyucusu iptal edince abonelik ve yuva serbest bırakılır.
 */
export async function openEventStream(request: Request, eventId: string): Promise<Response> {
  const access = await authorizeStream(request.headers, eventId);
  if (!access.ok) return plain(access.status, access.message);
  const { actor } = access;
  if (request.signal.aborted) return plain(499, "İstek iptal edildi");

  const release = acquireSlot(actor.id);
  if (!release) return plain(429, "Çok fazla açık canlı bağlantı");

  try {
    await ensureListening();
  } catch {
    release();
    return plain(503, "Canlı güncelleme şu anda kullanılamıyor");
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      const timers: { heartbeat?: ReturnType<typeof setInterval> } = {};

      const onAbort = () => cleanup();
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (timers.heartbeat) clearInterval(timers.heartbeat);
        unsubscribe();
        release();
        request.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // Akış zaten kapanmış/iptal edilmiş olabilir.
        }
      };

      const write = (chunk: string) => {
        if (closed) return;
        if ((controller.desiredSize ?? 0) < -MAX_QUEUED_FRAMES) {
          cleanup();
          return;
        }
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (error) {
          logError("realtime.stream.write", error);
          cleanup();
        }
      };

      write(`retry: ${RETRY_MS}\n: baglandi\n\n`);
      if (closed) return;
      unsubscribe = subscribe(eventId, (message) => write(frameOf(message)), { audiences: visibleAudiences(actor) });
      timers.heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      timers.heartbeat.unref?.();
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
