"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordAction, setUserActiveAction } from "../actions";
import { Field, FormStatus, toFormState, type FormState } from "./field";

type Props = { userId: string; isActive: boolean; isSelf: boolean };

/** Pasifleştirme/etkinleştirme ve parola sıfırlama. */
export function AccountPanel({ userId, isActive, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeState, setActiveState] = useState<FormState>(null);
  const [passwordState, setPasswordState] = useState<FormState>(null);

  function toggleActive() {
    const next = !isActive;
    if (!next && !window.confirm("Kullanıcı pasifleştirilecek ve tüm oturumları kapatılacak. Devam edilsin mi?")) {
      return;
    }
    setActiveState(null);
    startTransition(async () => {
      const result = await setUserActiveAction({ id: userId, active: next });
      setActiveState(toFormState(result, next ? "Kullanıcı etkinleştirildi" : "Kullanıcı pasifleştirildi"));
      if (result.ok) router.refresh();
    });
  }

  function onReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPasswordState(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ id: userId, password: String(data.get("password") ?? "") });
      setPasswordState(toFormState(result, "Parola sıfırlandı; kullanıcının açık oturumları kapatıldı"));
      if (result.ok) form.reset();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={isActive ? "destructive" : "default"}
          disabled={pending || (isSelf && isActive)}
          onClick={toggleActive}
        >
          {isActive ? "Pasifleştir" : "Etkinleştir"}
        </Button>
        {isSelf && isActive ? (
          <span className="text-xs text-muted-foreground">Kendi hesabınızı pasifleştiremezsiniz</span>
        ) : null}
        <FormStatus state={activeState} />
      </div>

      <form onSubmit={onReset} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="w-full max-w-xs">
          <Field id="new-password" label="Yeni parola" errors={passwordState?.fieldErrors?.password} hint="En az 12 karakter">
            <Input id="new-password" name="password" type="password" autoComplete="new-password" required />
          </Field>
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Parolayı sıfırla
        </Button>
        <FormStatus state={passwordState} />
      </form>
    </div>
  );
}
