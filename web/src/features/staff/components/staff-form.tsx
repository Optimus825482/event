"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function StaffForm({ options, initial }: { options: Options; initial?: StaffFormValues }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const payload = toPayload(formData);
    startTransition(async () => {
      const result = initial ? await updateStaff({ id: initial.id, ...payload }) : await createStaff(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage(result.message);
        return;
      }
      setErrors(undefined);
      setMessage(initial ? "Kaydedildi" : null);
      if (initial) router.refresh();
      else router.push(`/staff/${result.data.id}`);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {message ? (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-2 text-sm">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Renk" name="color" errors={errors}>
          <Input id="color" name="color" type="color" defaultValue={initial?.color ?? "#3b82f6"} className="h-9 p-1" />
        </Field>
        <Field label="Cinsiyet" name="gender" errors={errors}>
          <NativeSelect id="gender" name="gender" defaultValue={initial?.gender ?? ""}>
            <option value="">Seçilmedi</option>
            <option value="female">Kadın</option>
            <option value="male">Erkek</option>
          </NativeSelect>
        </Field>
        <Field label="Doğum tarihi" name="birthDate" errors={errors}>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={initial?.birthDate ?? ""} />
        </Field>
        <Field label="İşe giriş tarihi" name="hireDate" errors={errors}>
          <Input id="hireDate" name="hireDate" type="date" defaultValue={initial?.hireDate ?? ""} />
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
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : initial ? "Kaydet" : "Personel ekle"}
      </Button>
    </form>
  );
}
