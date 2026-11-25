import { logError } from "@/lib/log";
import type { NotificationAudience, RealtimeEvent } from "./events";

/**
 * Süreç içi dağıtıcı: LISTEN bağlantısından gelen olayları etkinlik kimliğine göre
 * açık SSE akışlarına iletir. Durum `globalThis` üzerinde tutulur; geliştirmede
 * modül yeniden yüklense de tek dağıtıcı ve tek LISTEN bağlantısı kalır.
 */

export type StreamMessage = { kind: "event"; event: RealtimeEvent } | { kind: "resync" };
export type StreamListener = (message: StreamMessage) => void;
/** `audiences`: aboneliğin sahibinin görebildiği bildirim kitleleri (verilmezse yalnızca "all"). */
export type SubscribeOptions = { audiences?: readonly NotificationAudience[] };

type Subscription = { eventId: string; audiences: readonly NotificationAudience[]; listener: StreamListener };

type HubState = { byEvent: Map<string, Set<Subscription>> };

const HUB_KEY = Symbol.for("eventflow.realtime.hub");
type GlobalWithHub = typeof globalThis & { [HUB_KEY]?: HubState };

function state(): HubState {
  const g = globalThis as GlobalWithHub;
  g[HUB_KEY] ??= { byEvent: new Map() };
  return g[HUB_KEY];
}

/** Etkinliğe abone olur; dönen işlev aboneliği kaldırır (birden çok çağrı güvenlidir). */
export function subscribe(eventId: string, listener: StreamListener, options: SubscribeOptions = {}): () => void {
  const { byEvent } = state();
  const subscription: Subscription = { eventId, audiences: options.audiences ?? ["all"], listener };
  let set = byEvent.get(eventId);
  if (!set) {
    set = new Set();
    byEvent.set(eventId, set);
  }
  set.add(subscription);
  return () => {
    const current = byEvent.get(eventId);
    if (!current) return;
    current.delete(subscription);
    if (current.size === 0) byEvent.delete(eventId);
  };
}

/** Açık abonelik sayısı (verilirse yalnızca o etkinlik için). */
export function listenerCount(eventId?: string): number {
  const { byEvent } = state();
  if (eventId !== undefined) return byEvent.get(eventId)?.size ?? 0;
  let total = 0;
  for (const set of byEvent.values()) total += set.size;
  return total;
}

function deliver(subscription: Subscription, message: StreamMessage): void {
  try {
    subscription.listener(message);
  } catch (error) {
    logError("realtime.hub.deliver", error);
  }
}

function allSubscriptions(): Subscription[] {
  return [...state().byEvent.values()].flatMap((set) => [...set]);
}

/**
 * Olayı ilgili aboneliklere iletir. `eventId` taşıyan olay yalnızca o etkinliğin
 * akışlarına gider; `audience` taşıyan bildirim, kitleyi görebilen akışlara
 * (`"all"` ise tüm akışlara) gider.
 */
export function dispatch(event: RealtimeEvent): void {
  if ("eventId" in event) {
    const set = state().byEvent.get(event.eventId);
    if (!set) return;
    for (const subscription of [...set]) deliver(subscription, { kind: "event", event });
    return;
  }
  for (const subscription of allSubscriptions()) {
    if (event.audience === "all" || subscription.audiences.includes(event.audience)) {
      deliver(subscription, { kind: "event", event });
    }
  }
}

/** Tüm akışlara "yeniden eşitle" sinyali (LISTEN bağlantısı yeniden kurulduğunda kaçan olaylar için). */
export function broadcastResync(): void {
  for (const subscription of allSubscriptions()) deliver(subscription, { kind: "resync" });
}
