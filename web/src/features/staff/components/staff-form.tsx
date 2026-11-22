"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createStaff, updateStaff } from "../actions/staff";
import type { CatalogOption } from "../queries";
import { Field, NativeSelect, numberOrNull, textOrNull, type FieldErrors } from "./field";

export type StaffFormValues = {
  id: string;
  sicilNo: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  positionId: string | null;
  workLocationId: string | null;
  mentor: string | null;
  color: string | null;
  gender: "male" | "female" | null;
  birthDate: string | null;
  bloodType: string | null;
  shoeSize: number | null;
  sockSize: string | null;
  hireDate: string | null;
};

type Options = {
  departments: CatalogOption[];
  positions: CatalogOption[];
  workLocations: CatalogOption[];
};

function toPayload(fd: FormData) {
  return {
    sicilNo: textOrNull(fd, "sicilNo") ?? "",
    fullName: textOrNull(fd, "fullName") ?? "",
    email: textOrNull(fd, "email"),
    phone: textOrNull(fd, "phone"),
    departmentId: textOrNull(fd, "departmentId"),
    positionId: textOrNull(fd, "positionId"),
    workLocationId: textOrNull(fd, "workLocationId"),
    mentor: textOrNull(fd, "mentor"),
    color: textOrNull(fd, "color"),
    gender: textOrNull(fd, "gender"),
    birthDate: textOrNull(fd, "birthDate"),
    bloodType: textOrNull(fd, "bloodType"),
    shoeSize: numberOrNull(fd, "shoeSize"),
    sockSize: textOrNull(fd, "sockSize"),
    hireDate: textOrNull(fd, "hireDate"),
  };
}

function CatalogSelect({
  name,
  value,
  options,
}: {
  name: string;
  value: string | null | undefined;
  options: CatalogOption[];
}) {
  return (
    <NativeSelect id={name} name={name} defaultValue={value ?? ""}>
      <option value="">Seçilmedi</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </NativeSelect>
  );
}


/** Alan adı -> sekme: sunucu doğrulama hatası olan alanın sekmesi açılır. */
const TABS_BY_FIELD: Record<string, TabKey> = {
  sicilNo: "basic",
  fullName: "basic",
  email: "basic",
  phone: "basic",
  color: "basic",
  departmentId: "work",
  positionId: "work",
  workLocationId: "work",
  mentor: "work",
  gender: "personal",
  bloodType: "personal",
  shoeSize: "personal",
  sockSize: "personal",
  birthDate: "dates",
  hireDate: "dates",
};

const TABS = [
  { key: "basic", label: "Temel" },
  { key: "work", label: "İş Bilgileri" },
  { key: "personal", label: "Kişisel" },
  { key: "dates", label: "Tarihler" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Sekme paneli: gizli paneller DOM'da kalır, böylece tüm alanlar tek formla gönderilir. */
function Panel({ active, tab, children }: { active: TabKey; tab: TabKey; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`staff-panel-${tab}`}
      aria-labelledby={`staff-tab-${tab}`}
      hidden={active !== tab}
      className="grid gap-4 sm:grid-cols-2"
    >
      {children}
    </div>
  );
}

export function StaffForm({ options, initial }: { options: Options; initial?: StaffFormValues }) {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<FieldErrors>();
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("basic");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const payload = toPayload(formData);
    startTransition(async () => {
      const result = initial ? await updateStaff({ id: initial.id, ...payload }) : await createStaff(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage(result.message);
        toast.error(result.message);
        // Hatalı alanın bulunduğu sekmeye geç.
        const firstBad = Object.keys(result.fieldErrors ?? {})[0];
        const target = TABS_BY_FIELD[firstBad ?? ""];
        if (target) setTab(target);
        return;
      }
      setErrors(undefined);
      setMessage(null);
      toast.success(initial ? "Personel kaydedildi" : "Personel eklendi");
      if (initial) router.refresh();
      else router.push(`/staff/${result.data.id}`);
    });
  }

  return (
    <form action={submit} onInvalidCapture={() => setTab("basic")} className="space-y-4">
      {message ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <div role="tablist" aria-label="Personel bilgileri" className="flex flex-wrap gap-1 border-b border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`staff-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`staff-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors focus-visible:outline-2",
              tab === t.key
                ? "border-blue-500 font-medium text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Panel active={tab} tab="basic">
        <Field label="Sicil no" name="sicilNo" errors={errors}>
          <Input id="sicilNo" name="sicilNo" defaultValue={initial?.sicilNo} required maxLength={50} />
        </Field>
        <Field label="Ad soyad" name="fullName" errors={errors}>
          <Input id="fullName" name="fullName" defaultValue={initial?.fullName} required maxLength={200} />
        </Field>
        <Field label="E-posta" name="email" errors={errors}>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
        </Field>
        <Field label="Telefon" name="phone" errors={errors}>
          <Input id="phone" name="phone" defaultValue={initial?.phone ?? ""} />
        </Field>
        <Field label="Renk" name="color" errors={errors}>
          <Input id="color" name="color" type="color" defaultValue={initial?.color ?? "#3b82f6"} className="h-9 p-1" />
        </Field>
      </Panel>

      <Panel active={tab} tab="work">
        <Field label="Bölüm" name="departmentId" errors={errors}>
          <CatalogSelect name="departmentId" value={initial?.departmentId} options={options.departments} />
        </Field>
        <Field label="Unvan" name="positionId" errors={errors}>
          <CatalogSelect name="positionId" value={initial?.positionId} options={options.positions} />
        </Field>
        <Field label="Görev yeri" name="workLocationId" errors={errors}>
          <CatalogSelect name="workLocationId" value={initial?.workLocationId} options={options.workLocations} />
        </Field>
        <Field label="Mentor" name="mentor" errors={errors}>
          <Input id="mentor" name="mentor" defaultValue={initial?.mentor ?? ""} />
        </Field>
      </Panel>

      <Panel active={tab} tab="personal">
        <Field label="Cinsiyet" name="gender" errors={errors}>
          <NativeSelect id="gender" name="gender" defaultValue={initial?.gender ?? ""}>
            <option value="">Seçilmedi</option>
            <option value="female">Kadın</option>
            <option value="male">Erkek</option>
          </NativeSelect>
        </Field>
        <Field label="Kan grubu" name="bloodType" errors={errors}>
          <Input id="bloodType" name="bloodType" defaultValue={initial?.bloodType ?? ""} maxLength={10} />
        </Field>
        <Field label="Ayakkabı numarası" name="shoeSize" errors={errors}>
          <Input id="shoeSize" name="shoeSize" type="number" defaultValue={initial?.shoeSize ?? ""} />
        </Field>
        <Field label="Çorap bedeni" name="sockSize" errors={errors}>
          <Input id="sockSize" name="sockSize" defaultValue={initial?.sockSize ?? ""} maxLength={20} />
        </Field>
      </Panel>

      <Panel active={tab} tab="dates">
        <Field label="Doğum tarihi" name="birthDate" errors={errors}>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={initial?.birthDate ?? ""} />
        </Field>
        <Field label="İşe giriş tarihi" name="hireDate" errors={errors}>
          <Input id="hireDate" name="hireDate" type="date" defaultValue={initial?.hireDate ?? ""} />
        </Field>
      </Panel>

      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : initial ? "Kaydet" : "Personel ekle"}
      </Button>
    </form>
  );
}
