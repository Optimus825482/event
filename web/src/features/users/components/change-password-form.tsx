"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { changeOwnPasswordAction } from "../actions";
import { passwordChangeError, validatePasswordChange } from "../password-change";
import { Field } from "./field";
import { PASSWORD_RULE_HINT } from "@/features/auth/password-policy";

const SUCCESS = "Parolanız değiştirildi; diğer oturumlar kapatıldı";
const NETWORK_ERROR = "Bağlantı hatası. Lütfen tekrar deneyin.";

/** Kendi parolasını değiştirme: `changeOwnPasswordAction` sunucu eylemiyle (auth uç noktası kapalıdır). */
export function ChangePasswordForm() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      current: String(data.get("currentPassword") ?? ""),
      next: String(data.get("newPassword") ?? ""),
      confirm: String(data.get("confirmPassword") ?? ""),
    };
    setDone(false);
    setFormError(null);
    const invalid = validatePasswordChange(input);
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) return;

    setPending(true);
    try {
      const result = await changeOwnPasswordAction({ currentPassword: input.current, newPassword: input.next });
      if (!result.ok) {
        const failure = passwordChangeError(result);
        if (failure.field) setErrors({ [failure.field]: failure.message });
        else setFormError(failure.message);
        toast.error(failure.message);
        return;
      }
      form.reset();
      setErrors({});
      setDone(true);
      toast.success(SUCCESS);
    } catch {
      setFormError(NETWORK_ERROR);
      toast.error(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  const list = (key: string) => (errors[key] ? [errors[key]] : undefined);
  const describe = (key: string, id: string) => (errors[key] ? `${id}-error` : undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div
        role="alert"
        className={formError ? "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" : "sr-only"}
      >
        {formError}
      </div>
      <p role="status" className={done ? "text-sm text-emerald-400" : "sr-only"}>
        {done ? SUCCESS : ""}
      </p>
      <Field id="currentPassword" label="Mevcut parola" errors={list("current")}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.current)}
          aria-describedby={describe("current", "currentPassword")}
        />
      </Field>
      <Field id="newPassword" label="Yeni parola" errors={list("next")} hint={PASSWORD_RULE_HINT}>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.next)}
          aria-describedby={describe("next", "newPassword")}
        />
      </Field>
      <Field id="confirmPassword" label="Yeni parola (tekrar)" errors={list("confirm")}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.confirm)}
          aria-describedby={describe("confirm", "confirmPassword")}
        />
      </Field>
      <Button type="submit" disabled={pending} className="bg-amber-600 text-white hover:bg-amber-700">
        {pending ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
