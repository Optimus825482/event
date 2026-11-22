"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { toFormState, type FormState } from "@/features/users/components/field";
import type { ActionResult } from "@/lib/action";

/** Sekme formlarının ortak kaydetme akışı: işlem, satır içi durum, toast ve sayfa yenileme. */
export function useSettingsSave(successMessage: string) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function save(task: () => Promise<ActionResult<unknown>>, afterOk?: () => void) {
    setState(null);
    startTransition(async () => {
      const result = await task();
      setState(toFormState(result, successMessage));
      if (result.ok) {
        toast.success(successMessage);
        afterOk?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return { pending, state, save };
}
