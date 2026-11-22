"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormStatus, toFormState, type FormState } from "@/features/users/components/field";
import { updateSettingsAction } from "../actions";
import type { PublicSettings } from "../service";

type BoolKey =
  | "snapToGrid"
  | "showGridByDefault"
  | "allowOverbooking"
  | "requirePhoneNumber"
  | "requireEmail"
  | "autoCheckInEnabled"
  | "checkInSoundEnabled"
  | "showTableDirections"
  | "emailNotifications"
  | "smsNotifications"
  | "qrCodeSystemEnabled"
  | "invitationSystemEnabled"
  | "smtpSecure";

const TOGGLE_GROUPS: { title: string; items: [BoolKey, string][] }[] = [
  {
    title: "Yerleşim",
    items: [
      ["snapToGrid", "Izgaraya yapıştır"],
      ["showGridByDefault", "Izgarayı varsayılan göster"],
    ],
  },
  {
    title: "Rezervasyon",
    items: [
      ["allowOverbooking", "Fazla rezervasyona izin ver"],
      ["requirePhoneNumber", "Telefon zorunlu"],
      ["requireEmail", "E-posta zorunlu"],
    ],
  },
  {
    title: "Check-in",
    items: [
      ["autoCheckInEnabled", "Otomatik check-in"],
      ["checkInSoundEnabled", "Check-in sesi"],
      ["showTableDirections", "Masa yönlendirmesini göster"],
    ],
  },
  {
    title: "Bildirim ve sistemler",
    items: [
      ["emailNotifications", "E-posta bildirimleri"],
      ["smsNotifications", "SMS bildirimleri"],
      ["qrCodeSystemEnabled", "QR kod sistemi"],
      ["invitationSystemEnabled", "Davetiye sistemi"],
    ],
  },
];

function text(data: FormData, name: string): string {
  return String(data.get(name) ?? "");
}

export function SettingsForm({ settings }: { settings: PublicSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const toggles = Object.fromEntries(
      [...TOGGLE_GROUPS.flatMap((g) => g.items), ["smtpSecure", ""] as [BoolKey, string]].map(([key]) => [
        key,
        data.get(key) === "on",
      ]),
    );
    // Parola: boş = değiştirme (alan hiç gönderilmez); "sil" işaretliyse null.
    const typed = text(data, "smtpPassword");
    const smtpPassword = data.get("clearSmtpPassword") === "on" ? null : typed === "" ? undefined : typed;

    setState(null);
    startTransition(async () => {
      const result = await updateSettingsAction({
        companyName: text(data, "companyName"),
        timezone: text(data, "timezone"),
        language: text(data, "language"),
        defaultGridSize: Number(text(data, "defaultGridSize")),
        defaultGuestCount: Number(text(data, "defaultGuestCount")),
        smtpHost: text(data, "smtpHost"),
        smtpPort: Number(text(data, "smtpPort")),
        smtpUser: text(data, "smtpUser"),
        smtpFromEmail: text(data, "smtpFromEmail"),
        smtpFromName: text(data, "smtpFromName"),
        ...toggles,
        ...(smtpPassword === undefined ? {} : { smtpPassword }),
      });
      setState(toFormState(result, "Ayarlar kaydedildi"));
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  const errors = state?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Genel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="companyName" label="Firma adı" errors={errors?.companyName}>
            <Input id="companyName" name="companyName" defaultValue={settings.companyName} required />
          </Field>
          <Field id="timezone" label="Saat dilimi" errors={errors?.timezone}>
            <Input id="timezone" name="timezone" defaultValue={settings.timezone} required />
          </Field>
          <Field id="language" label="Dil" errors={errors?.language}>
            <Input id="language" name="language" defaultValue={settings.language} required />
          </Field>
          <Field id="defaultGridSize" label="Varsayılan ızgara boyutu" errors={errors?.defaultGridSize}>
            <Input id="defaultGridSize" name="defaultGridSize" type="number" min={1} max={100} defaultValue={settings.defaultGridSize} />
          </Field>
          <Field id="defaultGuestCount" label="Varsayılan kişi sayısı" errors={errors?.defaultGuestCount}>
            <Input id="defaultGuestCount" name="defaultGuestCount" type="number" min={1} max={100} defaultValue={settings.defaultGuestCount} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Davranış</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {TOGGLE_GROUPS.map((group) => (
            <fieldset key={group.title} className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{group.title}</legend>
              {group.items.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={key} defaultChecked={settings[key]} />
                  {label}
                </label>
              ))}
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMTP (e-posta gönderimi)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="smtpSecure" defaultChecked={settings.smtpSecure} />
            Güvenli bağlantı (TLS)
          </label>
          {settings.smtpPasswordSet ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="clearSmtpPassword" />
              Kayıtlı parolayı sil
            </label>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Ayarları kaydet"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
