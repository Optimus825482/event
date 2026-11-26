import type { CheckInSuccess } from "../internal";

/**
 * Çevrimdışı check-in kuyruğunun SAF çekirdeği: IndexedDB, ağ ve zamanlayıcı yok; her işlev
 * girdiden yeni değerler üretir. Kurallar:
 * - `idempotencyKey` öğe oluşturulurken bir kez üretilir ve hiçbir yeniden denemede değişmez
 *   (kaybolan bir yanıttan sonra aynı anahtarla gönderim mükerrer check-in üretemez).
 * - Ağ hatası / 5xx: öğe `pending` kalır, üstel geri çekilmeyle yeniden denenir; hiçbir zaman düşmez.
 * - Sunucunun sakladığı iş kuralı sonucu (conflict / not_found / invalid): `failed`, tekrar denenmez.
 * - 401: kuyruk durur (`pauseForAuth`), öğe `pending` kalır ve deneme sayılmaz.
 * - İstek düzeyi ret (400/403/413/415): `failed` (kind "request"); operatör yeniden deneyebilir.
 * - Başarılı öğeler (`done`) olayla bildirilir; kalıcı silme çağıranın işidir.
 * - Her öğe, onu oluşturan kullanıcının kimliğini (`ownerId`) taşır. Yalnızca o anki oturumun
 *   sahibi olduğu öğeler gönderilir; başkasına ait (ya da sahibi bilinmeyen) öğeler kuyrukta
 *   bekletilir ve ancak sahibi yeniden oturum açınca gönderilir.
 */

export type WalkInTarget = { tableId: string; guestName: string; guestCount: number; guestPhone?: string };

/** `walkIn`: kapıda kayıt + giriş (ayrı öğe türü, aynı kuyruk, aynı anahtar/sahip kuralları). */
export type QueueTarget = { token: string } | { legacyHash: string } | { reservationId: string } | { ticketId: string } | { walkIn: WalkInTarget };

export type ItemKind = "check_in" | "walk_in";

/** Öğe türü hedeften türetilir (eski kayıtlarda ayrı alan yok, hepsi check-in). */
export function itemKind(item: Pick<QueueItem, "target">): ItemKind {
  return "walkIn" in item.target ? "walk_in" : "check_in";
}

export type ItemFailure =
  | { kind: "business"; code: "conflict" | "not_found" | "invalid"; message: string }
  | { kind: "request"; status: number; message: string };

export type QueueStatus = "pending" | "sending" | "failed" | "done";

export type QueueItem = {
  /** Hem depo anahtarı hem sunucuya giden `idempotencyKey`. */
  idempotencyKey: string;
  /** Öğeyi kuyruğa yazan kullanıcı; `null`: sahibi bilinmeyen (eski sürümden kalan) öğe, hiç gönderilmez. */
  ownerId: string | null;
  eventId: string;
  target: QueueTarget;
  /** Kapı numarası; öğe oluşturulurken sabitlenir. Eski kayıtlarda alan yoktur (kapısız). */
  gate?: number | null;
  /** Tarama anı (ISO); tekrar gönderimlerde değişmez. */
  clientTimestamp: string;
  /** Ekleme sırası: (enqueuedAt, seq, anahtar). */
  enqueuedAt: number;
  seq: number;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  failure: ItemFailure | null;
  result: CheckInSuccess | null;
};

export type ItemResult =
  { ok: true; data: CheckInSuccess } | { ok: false; code: string; message: string };

export type BatchOutcome =
  | { kind: "results"; results: ReadonlyArray<{ idempotencyKey: string | null; result: ItemResult }> }
  | { kind: "network" }
  | { kind: "retry"; status: number }
  | { kind: "unauthenticated" }
  | { kind: "rejected"; status: number; message: string };

export type SettledEvent =
  | { type: "done"; item: QueueItem }
  | { type: "failed"; item: QueueItem }
  | { type: "deferred"; item: QueueItem; reason: "network" | "server" | "auth" };

export const DEFAULT_BATCH_SIZE = 25;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

let sequence = 0;

/** n. denemeden sonra beklenecek süre: 2 sn'den başlayıp ikiye katlanır, 60 sn'de kalır; ±%25 sapma. */
export function backoffMs(attempts: number, random: number): number {
  const exponent = Math.min(Math.max(attempts, 1) - 1, 10);
  const base = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
  return Math.round(base * (0.75 + 0.5 * random));
}

export function createItem(input: {
  idempotencyKey: string;
  ownerId: string;
  eventId: string;
  target: QueueTarget;
  clientTimestamp: string;
  now: number;
  gate?: number | null;
}): QueueItem {
  sequence += 1;
  return {
    idempotencyKey: input.idempotencyKey,
    ownerId: input.ownerId,
    eventId: input.eventId,
    target: input.target,
    gate: input.gate ?? null,
    clientTimestamp: input.clientTimestamp,
    enqueuedAt: input.now,
    seq: sequence,
    status: "pending",
    attempts: 0,
    nextAttemptAt: input.now,
    lastError: null,
    failure: null,
    result: null,
  };
}

export function compareItems(a: QueueItem, b: QueueItem): number {
  return (
    a.enqueuedAt - b.enqueuedAt || a.seq - b.seq || (a.idempotencyKey < b.idempotencyKey ? -1 : 1)
  );
}

/** Şema 1'den kalan öğe (sahibi kaydedilmemiş): öğe korunur, sahibi bilinmeyen olarak bekletilir. */
export function migrateStoredItem(item: QueueItem): QueueItem {
  return typeof item.ownerId === "string" ? item : { ...item, ownerId: null };
}

/** Yalnızca `userId`'ye ait öğeler; sahibi başka ya da bilinmeyen olanlar çıkarılır. */
export function ownedBy(items: readonly QueueItem[], userId: string): QueueItem[] {
  return items.filter((i) => i.ownerId === userId);
}

/** Başka kullanıcıya ait (ya da sahibi bilinmeyen), henüz sonuçlanmamış öğeler: bekletilir, gönderilmez. */
export function heldAside(items: readonly QueueItem[], userId: string | null): QueueItem[] {
  return items.filter((i) => (i.ownerId === null || i.ownerId !== userId) && i.status !== "done");
}

/** Gönderilmesi gereken öğeler: beklemede ve zamanı gelmiş, ekleme sırasında, en çok `max`. */
export function selectDue(items: readonly QueueItem[], now: number, max: number): QueueItem[] {
  return items
    .filter((i) => i.status === "pending" && i.nextAttemptAt <= now)
    .sort(compareItems)
    .slice(0, max);
}

/** Seçilen öğeleri gönderiliyor işaretler; anahtar ve zaman damgası aynen kalır. */
export function claim(items: readonly QueueItem[], now: number): QueueItem[] {
  return items.map((i) => ({ ...i, status: "sending" as const, attempts: i.attempts + 1, nextAttemptAt: now }));
}

/** Yarıda kalmış (sekme kapandı vb.) `sending` öğeler aynı anahtarla yeniden beklemeye alınır. */
export function recoverInterrupted(items: readonly QueueItem[]): QueueItem[] {
  return items.map((i) => (i.status === "sending" ? { ...i, status: "pending" as const } : i));
}

export function summarize(items: readonly QueueItem[]): { pending: number; failed: number } {
  let pending = 0;
  let failed = 0;
  for (const i of items) {
    if (i.status === "pending" || i.status === "sending") pending += 1;
    else if (i.status === "failed") failed += 1;
  }
  return { pending, failed };
}

/** Yalnızca istek düzeyi hatalar operatörce yeniden denenebilir; saklanan iş kuralı sonucu aynı kalır. */
export function retryFailed(item: QueueItem, now: number): QueueItem {
  if (item.status !== "failed" || item.failure?.kind !== "request") return item;
  return { ...item, status: "pending", failure: null, lastError: null, nextAttemptAt: now };
}

type Context = { now: number; random: number };
type Applied = { items: QueueItem[]; pauseForAuth: boolean; events: SettledEvent[] };

const BUSINESS_CODES = new Set(["conflict", "not_found", "invalid"]);

function defer(item: QueueItem, ctx: Context, message: string): QueueItem {
  return {
    ...item,
    status: "pending",
    lastError: message,
    nextAttemptAt: ctx.now + backoffMs(item.attempts, ctx.random),
  };
}

function pauseAuth(item: QueueItem, ctx: Context): QueueItem {
  return {
    ...item,
    status: "pending",
    attempts: Math.max(item.attempts - 1, 0),
    lastError: "Oturum süresi doldu",
    nextAttemptAt: ctx.now,
  };
}

function applyItemResult(item: QueueItem, result: ItemResult | undefined, ctx: Context): { item: QueueItem; event: SettledEvent } {
  if (!result) {
    const next = defer(item, ctx, "Sunucu bu girişin sonucunu döndürmedi");
    return { item: next, event: { type: "deferred", item: next, reason: "server" } };
  }
  if (result.ok) {
    const next: QueueItem = { ...item, status: "done", result: result.data, lastError: null };
    return { item: next, event: { type: "done", item: next } };
  }
  if (BUSINESS_CODES.has(result.code)) {
    const code = result.code as "conflict" | "not_found" | "invalid";
    const next: QueueItem = {
      ...item,
      status: "failed",
      failure: { kind: "business", code, message: result.message },
      lastError: result.message,
    };
    return { item: next, event: { type: "failed", item: next } };
  }
  if (result.code === "unauthenticated") {
    const next = pauseAuth(item, ctx);
    return { item: next, event: { type: "deferred", item: next, reason: "auth" } };
  }
  if (result.code === "forbidden") {
    const next: QueueItem = {
      ...item,
      status: "failed",
      failure: { kind: "request", status: 403, message: result.message },
      lastError: result.message,
    };
    return { item: next, event: { type: "failed", item: next } };
  }
  const next = defer(item, ctx, result.message);
  return { item: next, event: { type: "deferred", item: next, reason: "server" } };
}

/**
 * Gönderilen (`sending`) öğelere sunucu/ağ sonucunu uygular. Yeni öğeler girdiyle aynı sırada döner.
 */
export function applyOutcome(sent: readonly QueueItem[], outcome: BatchOutcome, ctx: Context): Applied {
  const events: SettledEvent[] = [];
  const out: QueueItem[] = [];
  let pauseForAuth = false;

  if (outcome.kind === "results") {
    const byKey = new Map<string, ItemResult>();
    for (const r of outcome.results) if (r.idempotencyKey) byKey.set(r.idempotencyKey, r.result);
    for (const item of sent) {
      const applied = applyItemResult(item, byKey.get(item.idempotencyKey), ctx);
      if (applied.event.type === "deferred" && applied.event.reason === "auth") pauseForAuth = true;
      out.push(applied.item);
      events.push(applied.event);
    }
    return { items: out, pauseForAuth, events };
  }

  for (const item of sent) {
    let next: QueueItem;
    let event: SettledEvent;
    if (outcome.kind === "unauthenticated") {
      pauseForAuth = true;
      next = pauseAuth(item, ctx);
      event = { type: "deferred", item: next, reason: "auth" };
    } else if (outcome.kind === "rejected") {
      next = {
        ...item,
        status: "failed",
        failure: { kind: "request", status: outcome.status, message: outcome.message },
        lastError: outcome.message,
      };
      event = { type: "failed", item: next };
    } else if (outcome.kind === "retry") {
      next = defer(item, ctx, `Sunucu hatası (${outcome.status})`);
      event = { type: "deferred", item: next, reason: "server" };
    } else {
      next = defer(item, ctx, "Bağlantı yok");
      event = { type: "deferred", item: next, reason: "network" };
    }
    out.push(next);
    events.push(event);
  }
  return { items: out, pauseForAuth, events };
}
