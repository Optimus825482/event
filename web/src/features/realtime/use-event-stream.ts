"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { decodeRealtimeEvent, REALTIME_EVENT_TYPES } from "./events";
import { keysToInvalidate } from "./keys";

export type EventStreamStatus = "connecting" | "open" | "reconnecting";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Etkinliğin SSE akışına bağlanır ve gelen olaylarda ilgili TanStack Query
 * önbelleğini geçersiz kılar (veri, yetki denetimli normal sorgularla yeniden
 * çekilir). Ağ kopmalarında EventSource kendisi yeniden bağlanır; sunucu
 * bağlantıyı 4xx/5xx ile reddederse (EventSource kapanır) sınırlı üstel
 * geri çekilmeyle yeniden denenir. Her yeniden bağlantıda kaçan olaylar için
 * etkinliğin tüm sorguları geçersiz kılınır.
 *
 * `QueryClientProvider` altında kullanılmalıdır.
 */
export function useEventStream(eventId: string | null | undefined): EventStreamStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EventStreamStatus>("connecting");

  useEffect(() => {
    if (!eventId || typeof EventSource === "undefined") return;
    const url = `/api/events/${encodeURIComponent(eventId)}/stream`;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let hadError = false;
    let disposed = false;

    const invalidate = (keys: readonly (readonly string[])[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const onRealtime = (message: MessageEvent<string>) => {
      const event = decodeRealtimeEvent(message.data);
      if (event) invalidate(keysToInvalidate(event, eventId));
    };
    const onResync = () => invalidate(keysToInvalidate("resync", eventId));

    const open = () => {
      const es = new EventSource(url, { withCredentials: true });
      source = es;
      es.onopen = () => {
        attempt = 0;
        setStatus("open");
        if (hadError) onResync();
        hadError = false;
      };
      es.onerror = () => {
        hadError = true;
        setStatus("reconnecting");
        if (es.readyState !== EventSource.CLOSED || disposed) return;
        // Sunucu reddetti (ör. 401/403/429/503): EventSource kendisi denemez.
        const delay = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(open, delay);
      };
      for (const type of REALTIME_EVENT_TYPES) es.addEventListener(type, onRealtime);
      es.addEventListener("resync", onResync);
    };

    open();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [eventId, queryClient]);

  return status;
}
