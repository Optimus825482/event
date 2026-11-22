"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormStatus, type FormState } from "@/features/users/components/field";
import { updateSettingsAction } from "../actions";
import type { PublicSettings } from "../service";
import { useSettingsSave } from "./use-settings-save";

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
  | "invitationSystemEnabled";

const BEHAVIOR_GROUPS: { title: string; items: [BoolKey, string][] }[] = [
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
];

const NOTIFICATION_ITEMS: [BoolKey, string][] = [
  ["emailNotifications", "E-posta bildirimleri"],
  ["smsNotifications", "SMS bildirimleri"],
  ["qrCodeSystemEnabled", "QR kod sistemi"],
  ["invitationSystemEnabled", "Davetiye sistemi"],
];

function text(data: FormData, name: string): string {
  return String(data.get(name) ?? "");
}

function toggles(data: FormData, keys: BoolKey[]): Partial<Record<BoolKey, boolean>> {
  return Object.fromEntries(keys.map((key) => [key, data.get(key) === "on"]));
}

function Checkbox({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-200">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-amber-500" />
      {label}
    </label>
  );
}

export function SectionCard({
  title,
  description,
  state,
  pending,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  state: FormState;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending} className="bg-amber-600 text-white hover:bg-amber-700">
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            {state && !state.ok ? <FormStatus state={state} /> : null}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export function GeneralSection({ settings }: { settings: PublicSettings }) {
  const { pending, state, save } = useSettingsSave("Genel ayarlar kaydedildi");
  const errors = state?.fieldErrors;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(() =>
      updateSettingsAction({
        companyName: text(data, "companyName"),
        timezone: text(data, "timezone"),
        language: text(data, "language"),
        defaultGridSize: Number(text(data, "defaultGridSize")),
        defaultGuestCount: Number(text(data, "defaultGuestCount")),
      }),
    );
  }

  return (
    <SectionCard title="Genel" description="Firma ve varsayılan değerler" state={state} pending={pending} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </SectionCard>
  );
}

export function BehaviorSection({ settings }: { settings: PublicSettings }) {
  const { pending, state, save } = useSettingsSave("Davranış ayarları kaydedildi");
  const keys = BEHAVIOR_GROUPS.flatMap((g) => g.items.map(([key]) => key));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(() => updateSettingsAction(toggles(data, keys)));
  }

  return (
    <SectionCard title="Davranış" description="Yerleşim, rezervasyon ve check-in tercihleri" state={state} pending={pending} onSubmit={onSubmit}>
      <div className="grid gap-6 sm:grid-cols-3">
        {BEHAVIOR_GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-white">{group.title}</legend>
            {group.items.map(([key, label]) => (
              <Checkbox key={key} name={key} label={label} checked={settings[key]} />
            ))}
          </fieldset>
        ))}
      </div>
    </SectionCard>
  );
}

export function NotificationsSection({ settings }: { settings: PublicSettings }) {
  const { pending, state, save } = useSettingsSave("Bildirim ayarları kaydedildi");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(() =>
      updateSettingsAction(
        toggles(
          data,
          NOTIFICATION_ITEMS.map(([key]) => key),
        ),
      ),
    );
  }

  return (
    <SectionCard title="Bildirimler ve sistemler" state={state} pending={pending} onSubmit={onSubmit}>
      <fieldset className="space-y-2">
        <legend className="sr-only">Bildirim ve sistem seçenekleri</legend>
        {NOTIFICATION_ITEMS.map(([key, label]) => (
          <Checkbox key={key} name={key} label={label} checked={settings[key]} />
        ))}
      </fieldset>
    </SectionCard>
  );
}
