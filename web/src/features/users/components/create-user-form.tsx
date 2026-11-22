"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { ROLES } from "@/features/auth/roles";
import { createUserAction } from "../actions";
import { Field, FormStatus, SELECT_CLASS, toFormState, type FormState } from "./field";

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState(null);
    startTransition(async () => {
      const result = await createUserAction({
        username: String(data.get("username") ?? ""),
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        role: String(data.get("role") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      setState(toFormState(result, "Kullanıcı oluşturuldu"));
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  const errors = state?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field id="username" label="Kullanıcı adı" errors={errors?.username}>
        <Input id="username" name="username" autoComplete="off" required aria-invalid={Boolean(errors?.username)} />
      </Field>
      <Field id="name" label="Ad soyad" errors={errors?.name} hint="Boşsa kullanıcı adı kullanılır">
        <Input id="name" name="name" autoComplete="off" />
      </Field>
      <Field id="email" label="E-posta" errors={errors?.email} hint="Boşsa yer tutucu adres atanır">
        <Input id="email" name="email" type="email" autoComplete="off" />
      </Field>
      <Field id="role" label="Rol" errors={errors?.role}>
        <select id="role" name="role" defaultValue="staff" className={SELECT_CLASS}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="password" label="Parola" errors={errors?.password} hint="En az 12 karakter">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors?.password)}
        />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Oluşturuluyor…" : "Kullanıcı oluştur"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
