import { Client, type Notification } from "pg";
import { env } from "@/env";
import { logError } from "@/lib/log";
import { decodeRealtimeEvent, REALTIME_CHANNEL } from "./events";
import { broadcastResync, dispatch, listenerCount } from "./hub";

/**
 * Süreç başına tek, havuz dışı `pg.Client` ile `LISTEN eventflow_events`.
 * İlk abonelikte tembel açılır; koparsa sınırlı üstel geri çekilmeyle yeniden
 * bağlanır ve bağlantı yeniden kurulunca tüm akışlara `resync` gönderir (kopukluk
 * sırasında kaçan olaylar için istemci veriyi yeniden çeker).
 */

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

type ListenerState = {
  client: Client | null;
  connecting: Promise<void> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  attempt: number;
  /** Daha önce en az bir kez bağlanıldı mı (yeniden bağlantıda resync için). */
  hasConnected: boolean;
  /** `closeRealtime` her çağrıldığında artar; eski bağlantı girişimleri yok sayılır. */
  generation: number;
};

const LISTENER_KEY = Symbol.for("eventflow.realtime.listener");
type GlobalWithListener = typeof globalThis & { [LISTENER_KEY]?: ListenerState };

function state(): ListenerState {
  const g = globalThis as GlobalWithListener;
  g[LISTENER_KEY] ??= {
    client: null,
    connecting: null,
    retryTimer: null,
    attempt: 0,
    hasConnected: false,
    generation: 0,
  };
  return g[LISTENER_KEY];
}

function onNotification(message: Notification): void {
  if (message.channel !== REALTIME_CHANNEL) return;
  const event = decodeRealtimeEvent(message.payload);
  if (!event) {
    logError("realtime.listener.decode", new Error("Tanınmayan canlı güncelleme yükü yok sayıldı"));
    return;
  }
  dispatch(event);
}

function scheduleReconnect(): void {
  const s = state();
  if (s.retryTimer) return;
  const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** s.attempt);
  s.attempt += 1;
  const generation = s.generation;
  s.retryTimer = setTimeout(() => {
    s.retryTimer = null;
    // Kimse dinlemiyorsa bir sonraki abonelik bağlantıyı tembel olarak açar.
    if (generation !== s.generation || listenerCount() === 0) return;
    ensureListening().catch(() => {
      // connect() hatayı günlüğe yazıp yeni denemeyi zaten planlar.
    });
  }, delay);
  s.retryTimer.unref?.();
}

function handleDrop(client: Client, error?: unknown): void {
  const s = state();
  if (s.client !== client) return;
  s.client = null;
  logError("realtime.listener.drop", error ?? new Error("LISTEN bağlantısı kapandı"));
  client.end().catch(() => undefined);
  scheduleReconnect();
}

async function connect(): Promise<void> {
  const s = state();
  const generation = s.generation;
  const client = new Client({ connectionString: env.DATABASE_URL, keepAlive: true });
  client.on("error", (error) => handleDrop(client, error));
  client.on("end", () => handleDrop(client));
  client.on("notification", onNotification);
  try {
    await client.connect();
    await client.query(`LISTEN "${REALTIME_CHANNEL}"`);
  } catch (error) {
    client.end().catch(() => undefined);
    logError("realtime.listener.connect", error);
    if (generation === s.generation && listenerCount() > 0) scheduleReconnect();
    throw error;
  }
  if (generation !== s.generation) {
    // Bağlanırken kapatıldı.
    await client.end().catch(() => undefined);
    return;
  }
  s.client = client;
  s.attempt = 0;
  if (s.hasConnected) broadcastResync();
  s.hasConnected = true;
}

/** Paylaşımlı LISTEN bağlantısının açık olmasını sağlar; açılamazsa hata fırlatır. */
export function ensureListening(): Promise<void> {
  const s = state();
  if (s.client) return Promise.resolve();
  s.connecting ??= connect().finally(() => {
    s.connecting = null;
  });
  return s.connecting;
}

/** Bağlantıyı kapatır ve bekleyen yeniden bağlanma girişimlerini iptal eder (testler / kapanış). */
export async function closeRealtime(): Promise<void> {
  const s = state();
  s.generation += 1;
  if (s.retryTimer) clearTimeout(s.retryTimer);
  s.retryTimer = null;
  s.attempt = 0;
  s.hasConnected = false;
  await s.connecting?.catch(() => undefined);
  const client = s.client;
  s.client = null;
  if (client) await client.end().catch(() => undefined);
}
