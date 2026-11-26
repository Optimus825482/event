"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Role } from "@/features/auth/roles";
import { createUserAction } from "../actions";
import { ACCESS_MESSAGES } from "../access-rules";
import type { LinkableStaff } from "../queries";
import { ROLE_CHOICES, usesDepartments } from "../form-model";
import { Field, FormStatus, SELECT_CLASS, toFormState, type FormState } from "./field";
import { StaffLinkField } from "./staff-link-field";
import { AccessFields, type AccessValue } from "./membership-fields";

const CREATED_MESSAGE = "Kullanıcı oluşturuldu";
const EMPTY_ACCESS: AccessValue = { memberships: [], grants: [] };

export function CreateUserForm({
  onDone,
  staffOptions = [],
}: {
  onDone?: (message: string) => void;
  staffOptions?: readonly LinkableStaff[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [role, setRole] = useState<Role>("user");
  const [access, setAccess] = useState<AccessValue>(EMPTY_ACCESS);
  const [staffId, setStaffId] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState(null);
    const withDepartments = usesDepartments(role);
    if (withDepartments && access.memberships.length === 0) {
      setState({ ok: false, message: ACCESS_MESSAGES.needDepartment });
      return;
    }
    startTransition(async () => {
      const result = await createUserAction({
        username: String(data.get("username") ?? ""),
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        role,
        staffId,
        password: String(data.get("password") ?? ""),
        memberships: withDepartments ? access.memberships : [],
        permissions: withDepartments ? access.grants : [],
      });
      setState(toFormState(result, CREATED_MESSAGE));
      if (result.ok) {
        toast.success(CREATED_MESSAGE);
        form.reset();
        setRole("user");
        setAccess(EMPTY_ACCESS);
        setStaffId(null);
        router.refresh();
        onDone?.(CREATED_MESSAGE);
      } else {
        toast.error(result.message);
      }
    });
  }

  const errors = state?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
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
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={SELECT_CLASS}
        >
          {ROLE_CHOICES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
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
      <StaffLinkField options={staffOptions} value={staffId} onChange={setStaffId} errors={errors?.staffId} />
      {usesDepartments(role) ? <AccessFields value={access} onChange={setAccess} /> : null}
      <div className="flex items-end gap-3 sm:col-span-2 in-data-[slot=dialog-content]:sticky in-data-[slot=dialog-content]:bottom-0 in-data-[slot=dialog-content]:z-10 in-data-[slot=dialog-content]:-mx-6 in-data-[slot=dialog-content]:-mb-6 in-data-[slot=dialog-content]:border-t in-data-[slot=dialog-content]:bg-background in-data-[slot=dialog-content]:px-6 in-data-[slot=dialog-content]:py-4">
        <Button type="submit" disabled={pending} className="bg-amber-600 text-white hover:bg-amber-700">
          {pending ? "Oluşturuluyor…" : "Kullanıcı oluştur"}
        </Button>
        {state && !state.ok ? <FormStatus state={state} /> : null}
      </div>
    </form>
  );
}
