"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action";

type ActionFn<O> = (raw: unknown) => Promise<ActionResult<O>>;

export type ActionFailure = { message: string; fieldErrors: Record<string, string[]> };

/** Sunucu eylemini çalıştırır; hata durumunu (`message`, `fieldErrors`) ve bekleme durumunu tutar. */
export function useRunAction() {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  function run<O>(action: ActionFn<O>, input: unknown, onSuccess?: (data: O) => void): void {
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        setFailure(null);
        onSuccess?.(result.data);
      } else {
        setFailure({ message: result.message, fieldErrors: result.fieldErrors ?? {} });
      }
    });
  }

  return { pending, failure, run, clear: () => setFailure(null) };
}
