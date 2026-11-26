"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action";

export const FAILED_MESSAGE = "İşlem tamamlanamadı";

/**
 * Eylem çalıştırıcı: `busy` her durumda sıfırlanır, başarısızlık toast'ta ve kalıcı `error` metninde görünür,
 * başarıda toast + `router.refresh()`. Reddedilen çağrı (ağ hatası vb.) da yakalanır.
 */
export function useFinanceAction() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(call: () => Promise<ActionResult<T>>, success: string): Promise<ActionResult<T> | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await call();
        if (result.ok) {
          toast.success(success);
          router.refresh();
        } else {
          setError(result.message);
          toast.error(result.message);
        }
        return result;
      } catch {
        setError(FAILED_MESSAGE);
        toast.error(FAILED_MESSAGE);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [toast, router],
  );

  return { busy, error, setError, run };
}

/** Sunucunun alan hatalarından ilk iletileri alır. */
export function firstFieldErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages[0]) out[key] = messages[0];
  }
  return out;
}
