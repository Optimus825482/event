"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, useTransition } from "react";
import { realtimeKeys } from "@/features/realtime/keys";
import type { ActionResult } from "@/lib/action";
import { checkInAction } from "../actions";
import type { CheckInSuccess } from "../internal";
import type { ScannedCode } from "../scan-code";

export type CheckInFeedback =
  { kind: "success" | "already"; result: CheckInSuccess } | { kind: "error"; code: string; message: string };

export type CheckInTarget = ScannedCode | { reservationId: string };

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
 * Check-in gönderimi. Her deneme için yeni bir `idempotencyKey` üretilir; çift tıklama aynı
 * gönderimi tekrarlamaz (bekleme sırasında düğmeler kapalı). İş kuralı sonuçları kullanıcıya
 * başarı / zaten yapıldı / hata olarak gösterilir.
 */
export function useCheckIn(eventId: string) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CheckInFeedback | null>(null);
  const refresh = useRefreshEvent(eventId);

  const submit = useCallback(
    (target: CheckInTarget) => {
      startTransition(async () => {
        const result = await checkInAction({
          eventId,
          idempotencyKey: crypto.randomUUID(),
          clientTimestamp: new Date().toISOString(),
          ...target,
        });
        if (result.ok) {
          setFeedback({
            kind: result.data.outcome === "checked_in" ? "success" : "already",
            result: result.data,
          });
          refresh();
        } else {
          setFeedback({
            kind: "error",
            code: result.code,
            message: result.message,
          });
        }
      });
    },
    [eventId, refresh],
  );

  return {
    submit,
    pending,
    feedback,
    setFeedback,
    clear: () => setFeedback(null),
  };
}
