"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { compareItems, heldAside, ownedBy, summarize, type QueueItem, type QueueTarget, type SettledEvent } from "./queue-core";
import { getQueueRuntime, type EnqueueMeta } from "./runtime";

const FLUSH_INTERVAL_MS = 15_000;

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Tarayıcının bağlantı durumu (sunucuda `true` varsayılır; ilk çizimde uyuşmazlık olmaz). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export type OfflineQueue = {
  /** Yalnızca oturumdaki kullanıcıya ait öğeler. */
  items: QueueItem[];
  /** Başka kullanıcıya ait (ya da sahibi bilinmeyen) bekleyen girişlerin sayısı: gönderilmez, bekletilir. */
  heldAsideCount: number;
  pending: number;
  failed: QueueItem[];
  paused: boolean;
  online: boolean;
  durable: boolean;
  /** Yalnızca kalıcı olarak kuyruğa yazar; göndermek için `flushNow` çağrılır. */
  enqueue(eventId: string, target: QueueTarget, meta?: EnqueueMeta): Promise<QueueItem>;
  enqueueMany(eventId: string, targets: readonly QueueTarget[], meta?: EnqueueMeta): Promise<QueueItem[]>;
  flushNow(): Promise<void>;
  /** Anlık durum (render beklemeden): 401 sonrası kuyruk duraklatıldı mı. */
  isPausedNow(): boolean;
  /** Oturum yenilendikten sonra durdurulmuş kuyruğu sürdürür. */
  resume(): Promise<void>;
  retry(item: QueueItem): Promise<void>;
  dismiss(key: string): Promise<void>;
};

/**
 * Kuyruğun React kancası. Boşaltma tetikleyicileri: açılış, `online` olayı, sekme görünür olunca
 * ve 15 sn'lik zamanlayıcı. `onEvents` her boşaltma sonucunu (done/failed/deferred) bildirir.
 */
export function useOfflineQueue(userId: string, onEvents?: (events: SettledEvent[]) => void): OfflineQueue {
  const online = useOnline();

  const durable = useSyncExternalStore(
    () => () => undefined,
    () => getQueueRuntime().durable,
    () => true,
  );
  const [allItems, setAllItems] = useState<QueueItem[]>([]);
  const [paused, setPaused] = useState(false);

  // Kimlik sunucudan (oturum) gelir. Aşağıdaki boşaltma efektinden ÖNCE bildirilmelidir.
  useEffect(() => {
    getQueueRuntime().setUser(userId);
  }, [userId]);

  useEffect(() => {
    const runtime = getQueueRuntime();
    let active = true;
    const refresh = () => {
      void runtime.list().then((all) => {
        if (!active) return;
        setAllItems(all.sort(compareItems));
        setPaused(runtime.isPaused());
      });
    };
    refresh();
    const unsubscribe = runtime.onChange(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!onEvents) return;
    return getQueueRuntime().onEvents(onEvents);
  }, [onEvents]);

  useEffect(() => {
    const runtime = getQueueRuntime();
    const flush = () => void runtime.flush();
    // Bağlantı geri gelince geri çekilme beklenmez (çevrimdışıyken yapılan denemeler süreyi uzatmıştır).
    const flushNowOnReconnect = () => void runtime.flush({ ignoreBackoff: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    flush();
    window.addEventListener("online", flushNowOnReconnect);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, FLUSH_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", flushNowOnReconnect);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const items = useMemo(() => ownedBy(allItems, userId), [allItems, userId]);
  const heldAsideCount = useMemo(() => heldAside(allItems, userId).length, [allItems, userId]);

  const enqueue = useCallback(
    async (eventId: string, target: QueueTarget, meta?: EnqueueMeta) => {
      return getQueueRuntime().enqueue(eventId, target, meta);
    },
    [],
  );

  const enqueueMany = useCallback(
    async (eventId: string, targets: readonly QueueTarget[], meta?: EnqueueMeta) => {
      return getQueueRuntime().enqueueMany(eventId, targets, meta);
    },
    [],
  );

  const flushNow = useCallback(async () => {
    await getQueueRuntime().flush({ ignoreBackoff: true });
  }, []);

  const isPausedNow = useCallback(() => getQueueRuntime().isPaused(), []);

  const resume = useCallback(async () => {
    const rt = getQueueRuntime();
    rt.resume();
    await rt.flush({ ignoreBackoff: true });
  }, []);

  const retry = useCallback(
    async (item: QueueItem) => {
      const rt = getQueueRuntime();
      await rt.retry(item);
      await rt.flush();
    },
    [],
  );

  const dismiss = useCallback(async (key: string) => getQueueRuntime().dismiss(key), []);

  return useMemo(
    () => ({
      items,
      heldAsideCount,
      pending: summarize(items).pending,
      failed: items.filter((i) => i.status === "failed"),
      paused,
      online,
      durable,
      enqueue,
      enqueueMany,
      flushNow,
      isPausedNow,
      resume,
      retry,
      dismiss,
    }),
    [items, heldAsideCount, paused, online, durable, enqueue, enqueueMany, flushNow, isPausedNow, resume, retry, dismiss],
  );
}
