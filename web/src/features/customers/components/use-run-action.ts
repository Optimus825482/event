"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action";

type ActionFn<O> = (raw: unknown) => Promise<ActionResult<O>>;

export type ActionFailure = { message: string; fieldErrors: Record<string, string[]> };

/**
 * Sunucu eylemini çalıştırır; hata durumunu (`message`, `fieldErrors`) ve bekleme durumunu tutar.
 * `successMessage` verilirse sonuç ayrıca bildirim (toast) olarak da gösterilir.
 */
export function useRunAction() {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const toast = useToast();

  function run<O>(action: ActionFn<O>, input: unknown, onSuccess?: (data: O) => void, successMessage?: string): void {
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        setFailure(null);
        if (successMessage) toast.success(successMessage);
        onSuccess?.(result.data);
      } else {
        setFailure({ message: result.message, fieldErrors: result.fieldErrors ?? {} });
        if (successMessage) toast.error(result.message);
      }
    });
  }

  return { pending, failure, run, clear: () => setFailure(null) };
}
