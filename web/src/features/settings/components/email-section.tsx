"use client";

import type { FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/features/users/components/field";
import { updateSettingsAction } from "../actions";
import type { PublicSettings } from "../service";
import { SectionCard } from "./settings-sections";
import { useSettingsSave } from "./use-settings-save";

function text(data: FormData, name: string): string {
  return String(data.get(name) ?? "");
}

/** SMTP ayarları. Parola yalnızca yazılabilir: boş bırakılırsa korunur, işaretlenirse silinir. */
export function EmailSection({ settings }: { settings: PublicSettings }) {
  const { pending, state, save } = useSettingsSave("E-posta ayarları kaydedildi");
  const errors = state?.fieldErrors;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const typed = text(data, "smtpPassword");
    const smtpPassword = data.get("clearSmtpPassword") === "on" ? null : typed === "" ? undefined : typed;
    save(
      () =>
        updateSettingsAction({
          smtpHost: text(data, "smtpHost"),
          smtpPort: Number(text(data, "smtpPort")),
          smtpUser: text(data, "smtpUser"),
          smtpFromEmail: text(data, "smtpFromEmail"),
          smtpFromName: text(data, "smtpFromName"),
          smtpSecure: data.get("smtpSecure") === "on",
          ...(smtpPassword === undefined ? {} : { smtpPassword }),
        }),
      () => form.reset(),
    );
  }

  return (
    <SectionCard
      title="SMTP (e-posta gönderimi)"
      description="Davetiye ve bildirim e-postalarının gönderileceği sunucu"
      state={state}
      pending={pending}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="smtpHost" label="Sunucu" errors={errors?.smtpHost}>
          <Input id="smtpHost" name="smtpHost" defaultValue={settings.smtpHost ?? ""} />
        </Field>
        <Field id="smtpPort" label="Port" errors={errors?.smtpPort}>
          <Input id="smtpPort" name="smtpPort" type="number" min={1} max={65535} defaultValue={settings.smtpPort} />
        </Field>
        <Field id="smtpUser" label="Kullanıcı" errors={errors?.smtpUser}>
          <Input id="smtpUser" name="smtpUser" autoComplete="off" defaultValue={settings.smtpUser ?? ""} />
        </Field>
        <Field
          id="smtpPassword"
          label="Parola"
          errors={errors?.smtpPassword}
          hint={settings.smtpPasswordSet ? "Kayıtlı. Değiştirmek için yeni parola yazın, boş bırakırsanız korunur." : undefined}
        >
          <Input id="smtpPassword" name="smtpPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field id="smtpFromEmail" label="Gönderen e-posta" errors={errors?.smtpFromEmail}>
          <Input id="smtpFromEmail" name="smtpFromEmail" type="email" defaultValue={settings.smtpFromEmail ?? ""} />
        </Field>
        <Field id="smtpFromName" label="Gönderen adı" errors={errors?.smtpFromName}>
          <Input id="smtpFromName" name="smtpFromName" defaultValue={settings.smtpFromName ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" name="smtpSecure" defaultChecked={settings.smtpSecure} className="h-4 w-4 accent-amber-500" />
          Güvenli bağlantı (TLS)
        </label>
        {settings.smtpPasswordSet ? (
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" name="clearSmtpPassword" className="h-4 w-4 accent-amber-500" />
            Kayıtlı parolayı sil
          </label>
        ) : null}
      </div>
    </SectionCard>
  );
}
