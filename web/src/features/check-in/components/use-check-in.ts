"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { realtimeKeys } from "@/features/realtime/keys";
import type { ActionResult } from "@/lib/action";
import type { CheckInSuccess } from "../internal";
import type { SettledEvent, WalkInTarget } from "../offline/queue-core";
import type { OfflineQueue } from "../offline/use-offline-queue";
import type { ScannedCode } from "../scan-code";
import { tallyBatch, type BatchTally } from "./batch-feedback";

export type QueuedReason = "network" | "server" | "auth";

/** "queued": sunucu henüz onaylamadı, giriş kuyrukta; "success" ile KARIŞTIRILMAMALI. */
export type CheckInFeedback =
  | { kind: "success" | "already"; result: CheckInSuccess }
  | { kind: "queued"; reason: QueuedReason }
  | { kind: "batch"; tally: BatchTally }
  | { kind: "error"; code: string; message: string };

export type CheckInTarget = ScannedCode | { reservationId: string } | { ticketId: string } | { walkIn: WalkInTarget };

/** Sorgu işlevleri için: başarısız action sonucunu TanStack Query hatasına çevirir. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/** Etkinliğin canlı güncellenen sorgularını hemen yeniler (SSE olayı da aynı işi yapar). */
export function useRefreshEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    for (const queryKey of [
      realtimeKeys.stats(eventId),
      realtimeKeys.reservations(eventId),
      realtimeKeys.checkIns(eventId),
      realtimeKeys.tables(eventId),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [eventId, queryClient]);
}

/**
 * Check-in gönderimi: her giriş önce kalıcı kuyruğa yazılır (anahtar bir kez üretilir), sonra
 * çevrimiçiyse hemen gönderilir. Bu sekmeden gönderilen öğenin sonucu anında gösterilir: onaylı
 * giriş / zaten yapıldı / iş kuralı reddi / "kuyruğa alındı". Çevrimiçi reddedilen giriş bantta gösterilir ve
 * kuyruktan kaldırılır (hata listesinde ikinci kez görünmez). Kuyruğa alınan öğenin SONRAKİ sonucu
 * bandı ezmez; sayaç ve hata listesinde görünür.
 */
export function useCheckIn(eventId: string, queue: OfflineQueue, gate: number | null = null) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<CheckInFeedback | null>(null);
  const own = useRef(new Set<string>());
  /** Toplu gönderimde beklenen anahtarlar ve onlara ait olaylar (tek tek bant gösterilmez). */
  const batch = useRef<{ keys: Set<string>; events: SettledEvent[] } | null>(null);
  const refresh = useRefreshEvent(eventId);

  /** Kuyruk olaylarını işler; sonradan (bu ekranda gösterilmeden) eşitlenen giriş sayısını döndürür. */
  const onEvents = useCallback(
    (events: SettledEvent[]): number => {
      let changed = false;
      let syncedLater = 0;
      for (const event of events) {
        const key = event.item.idempotencyKey;
        if (event.type === "done") changed = true;
        if (batch.current?.keys.has(key)) {
          batch.current.events.push(event);
          if (event.type === "failed") void queue.dismiss(key);
          continue;
        }
        const mine = own.current.delete(key);
        // Çevrimiçi reddedilen giriş yalnızca bantta gösterilir; "Gönderilemeyen girişler" listesi
        // çevrimdışı kuyruktan geçen öğeler içindir.
        if (mine && event.type === "failed") void queue.dismiss(event.item.idempotencyKey);
        if (!mine) {
          if (event.type === "done") syncedLater += 1;
          continue;
        }
        if (event.type === "done" && event.item.result) {
          const { result } = event.item;
          setFeedback({ kind: result.outcome === "checked_in" ? "success" : "already", result });
        } else if (event.type === "failed") {
          setFeedback({
            kind: "error",
            code: event.item.failure?.kind === "business" ? event.item.failure.code : "error",
            message: event.item.failure?.message ?? "Giriş yapılamadı",
          });
        } else if (event.type === "deferred") {
          setFeedback({ kind: "queued", reason: event.reason });
        }
      }
      if (changed) refresh();
      return syncedLater;
    },
    [refresh, queue],
  );

  const submit = useCallback(
    (target: CheckInTarget) => {
      setPending(true);
      void (async () => {
        try {
          const item = await queue.enqueue(eventId, target, { gate });
          if (!navigator.onLine) {
            setFeedback({ kind: "queued", reason: "network" });
            return;
          }
          own.current.add(item.idempotencyKey);
          await queue.flushNow();
          // Olay gelmediyse boşaltma atlandı (duraklatılmış kuyruk ya da başka sekme boşaltıyor).
          if (own.current.delete(item.idempotencyKey)) {
            setFeedback({ kind: "queued", reason: queue.isPausedNow() ? "auth" : "server" });
          }
        } catch {
          setFeedback({
            kind: "error",
            code: "error",
            message: "Giriş kuyruğa yazılamadı; tarayıcı depolaması kullanılamıyor",
          });
        } finally {
          setPending(false);
        }
      })();
    },
    [eventId, queue, gate],
  );

  const submitMany = useCallback(
    (targets: readonly { ticketId: string }[]) => {
      if (targets.length === 0) return;
      setPending(true);
      void (async () => {
        try {
          const items = await queue.enqueueMany(eventId, targets, { gate });
          const keys = items.map((i) => i.idempotencyKey);
          if (!navigator.onLine) {
            setFeedback({ kind: "batch", tally: tallyBatch(keys, []) });
            return;
          }
          const collected = { keys: new Set(keys), events: [] as SettledEvent[] };
          batch.current = collected;
          try {
            await queue.flushNow();
          } finally {
            batch.current = null;
          }
          setFeedback({ kind: "batch", tally: tallyBatch(keys, collected.events) });
        } catch {
          setFeedback({
            kind: "error",
            code: "error",
            message: "Girişler kuyruğa yazılamadı; tarayıcı depolaması kullanılamıyor",
          });
        } finally {
          setPending(false);
        }
      })();
    },
    [eventId, queue, gate],
  );

  return { submit, submitMany, pending, feedback, setFeedback, clear: () => setFeedback(null), onEvents };
}
