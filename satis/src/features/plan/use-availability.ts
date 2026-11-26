"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Availability } from "@/lib/core/contract";
import { applyAvailability, PATCH_TTL_MS, pollDelayAfter, STALE_AFTER_FAILURES } from "./poll";

const isRow = (row: unknown): boolean =>
  typeof row === "object" &&
  row !== null &&
  typeof (row as { id?: unknown }).id === "string" &&
  typeof (row as { free?: unknown }).free === "number" &&
  Number.isFinite((row as { free: number }).free) &&
  (row as { free: number }).free >= 0;

const isAvailability = (value: unknown): value is Availability =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Availability).at === "string" &&
  Array.isArray((value as Availability).tables) &&
  (value as Availability).tables.every(isRow);

/** Yerel yama: yapıldığı andaki SUNUCU zaman damgasını kaydeder; cihaz saati karşılaştırmaya girmez. */
type LocalPatch = { id: number; tableId: string; free: number; baseAt: string };

const serverTime = (at: string): number => Date.parse(at) || 0;

/** Canlı doluluk: sekme görünürken ~5 sn'de bir `/api/durum/<id>` sorgulanır. */
export function useAvailability(
  eventId: string,
  initial: Availability,
): { availability: Availability; stale: boolean; refresh(): void; patch(tableId: string, free: number): void } {
  const [server, setServer] = useState<Availability>(initial);
  const [patches, setPatches] = useState<LocalPatch[]>([]);
  const patchId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
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
      timer = setTimeout(() => void poll(), pollDelayAfter(failures));
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
        const response = await fetch(`/api/durum/${encodeURIComponent(eventId)}`, { cache: "no-cache", signal: current.signal });
        if (cancelled) return;
        if (response.status === 304) {
          succeed();
        } else if (response.ok) {
          const body: unknown = await response.json();
          if (cancelled) return;
          if (isAvailability(body)) {
            setServer((now) => applyAvailability(now, body));
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

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const refresh = useCallback(() => pollRef.current(), []);

  // Yama, sunucu zaman damgası yamanın tabanından ilerleyene ya da ~8 sn geçene kadar etkindir.
  const availability = useMemo<Availability>(() => {
    const active = patches.filter((p) => serverTime(server.at) <= serverTime(p.baseAt));
    if (active.length === 0) return server;
    const byTable = new Map(active.map((p) => [p.tableId, p.free]));
    return { at: server.at, tables: server.tables.map((t) => (byTable.has(t.id) ? { ...t, free: byTable.get(t.id) as number } : t)) };
  }, [server, patches]);

  const patch = useCallback(
    (tableId: string, free: number) => {
      const id = (patchId.current += 1);
      setPatches((list) => [...list.filter((p) => p.tableId !== tableId), { id, tableId, free, baseAt: server.at }]);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setPatches((list) => list.filter((p) => p.id !== id));
      }, PATCH_TTL_MS);
      timers.current.add(timer);
    },
    [server.at],
  );

  return { availability, stale, refresh, patch };
}
