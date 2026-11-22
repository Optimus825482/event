"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { resetPasswordAction } from "../actions";
import { Field, FormStatus, toFormState, type FormState } from "./field";

const RESET_MESSAGE = "Parola sıfırlandı; kullanıcının açık oturumları kapatıldı";

/** Yönetici parola sıfırlama formu (kullanıcı ayrıntı sayfası ve liste penceresi ortak kullanır). */
export function ResetPasswordForm({ userId, onDone }: { userId: string; onDone?: (message: string) => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ id: userId, password: String(data.get("password") ?? "") });
      setState(toFormState(result, RESET_MESSAGE));
      if (result.ok) {
        toast.success(RESET_MESSAGE);
        form.reset();
        onDone?.(RESET_MESSAGE);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={onReset} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="w-full max-w-xs">
        <Field id="new-password" label="Yeni parola" errors={state?.fieldErrors?.password} hint="En az 12 karakter">
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sıfırlanıyor…" : "Parolayı sıfırla"}
      </Button>
      {state && !state.ok ? <FormStatus state={state} /> : null}
    </form>
  );
}
