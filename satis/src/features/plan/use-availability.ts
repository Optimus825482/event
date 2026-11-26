"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Availability } from "@/lib/core/contract";
import { applyAvailability, nextPollDelay, STALE_AFTER_FAILURES } from "./poll";

const isAvailability = (value: unknown): value is Availability =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Availability).at === "string" &&
  Array.isArray((value as Availability).tables);

/** Canlı doluluk: sekme görünürken ~5 sn'de bir `/api/durum/<id>` sorgulanır. */
export function useAvailability(
  eventId: string,
  initial: Availability,
): { availability: Availability; stale: boolean; refresh(): void; patch(tableId: string, free: number): void } {
  const [availability, setAvailability] = useState<Availability>(initial);
  const [stale, setStale] = useState(false);
  const pollRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inflight = false;
    let failures = 0;

    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (cancelled || document.visibilityState === "hidden") return;
      timer = setTimeout(() => void poll(), nextPollDelay());
    };
    const succeed = () => {
      failures = 0;
      setStale(false);
    };
    const fail = () => {
      failures += 1;
      if (failures >= STALE_AFTER_FAILURES) setStale(true);
    };

    async function poll(): Promise<void> {
      clear();
      if (cancelled || inflight) return;
      inflight = true;
      const current = new AbortController();
      controller = current;
      let aborted = false;
      try {
        const response = await fetch(`/api/durum/${encodeURIComponent(eventId)}`, { signal: current.signal });
        if (cancelled) return;
        if (response.status === 304) {
          succeed();
        } else if (response.ok) {
          const body: unknown = await response.json();
          if (cancelled) return;
          if (isAvailability(body)) {
            setAvailability((now) => applyAvailability(now, body));
            succeed();
          } else {
            fail();
          }
        } else {
          fail();
        }
      } catch {
        if (current.signal.aborted) aborted = true;
        else fail();
      } finally {
        inflight = false;
      }
      if (!cancelled && !aborted) schedule();
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clear();
        controller?.abort();
      } else {
        void poll();
      }
    };

    pollRef.current = () => void poll();
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      cancelled = true;
      clear();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [eventId]);

  const refresh = useCallback(() => pollRef.current(), []);

  const patch = useCallback((tableId: string, free: number) => {
    setAvailability((current) => {
      const row = current.tables.find((t) => t.id === tableId);
      if (!row || row.free === free) return current;
      const at = new Date(Math.max(Date.now(), (Date.parse(current.at) || 0) + 1)).toISOString();
      return { at, tables: current.tables.map((t) => (t.id === tableId ? { ...t, free } : t)) };
    });
  }, []);

  return { availability, stale, refresh, patch };
}
