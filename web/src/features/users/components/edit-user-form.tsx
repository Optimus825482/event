"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { ROLES } from "@/features/auth/roles";
import { updateUserAction } from "../actions";
import type { UserSummary } from "../types";
import { Field, FormStatus, SELECT_CLASS, toFormState, type FormState } from "./field";

export function EditUserForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState(null);
    startTransition(async () => {
      const result = await updateUserAction({
        id: user.id,
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        role: String(data.get("role") ?? ""),
        phone: String(data.get("phone") ?? ""),
        position: String(data.get("position") ?? ""),
      });
      setState(toFormState(result, "Kullanıcı güncellendi"));
      if (result.ok) router.refresh();
    });
  }

  const errors = state?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field id="name" label="Ad soyad" errors={errors?.name}>
        <Input id="name" name="name" defaultValue={user.name} required />
      </Field>
      <Field id="email" label="E-posta" errors={errors?.email}>
        <Input id="email" name="email" type="email" defaultValue={user.email} required />
      </Field>
      <Field id="role" label="Rol" errors={errors?.role}>
        <select id="role" name="role" defaultValue={user.role} className={SELECT_CLASS}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="phone" label="Telefon" errors={errors?.phone}>
        <Input id="phone" name="phone" defaultValue={user.phone ?? ""} />
      </Field>
      <Field id="position" label="Görev" errors={errors?.position}>
        <Input id="position" name="position" defaultValue={user.position ?? ""} />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
