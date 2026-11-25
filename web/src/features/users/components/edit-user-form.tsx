"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import type { Role } from "@/features/auth/roles";
import type { ActionResult } from "@/lib/action";
import { setPermissionsAction, setUserMembershipsAction, updateUserAction } from "../actions";
import { ACCESS_MESSAGES } from "../access-rules";
import { ROLE_CHOICES, usesDepartments } from "../form-model";
import type { UserDetail } from "../queries";
import { Field, FormStatus, SELECT_CLASS, toFormState, type FormState } from "./field";
import { AccessFields, type AccessValue } from "./membership-fields";

const UPDATED_MESSAGE = "Kullanıcı güncellendi";

export function EditUserForm({ user, onDone }: { user: UserDetail; onDone?: (message: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [role, setRole] = useState<Role>(user.role);
  const [access, setAccess] = useState<AccessValue>({ memberships: user.memberships, grants: user.permissions });
  // Eski roller (kaldırılana dek) listede kendi adıyla görünür ve değiştirilmedikçe korunur.
  const legacyRole = !ROLE_CHOICES.some((choice) => choice.value === user.role);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState(null);
    const withDepartments = usesDepartments(role);
    if (withDepartments && access.memberships.length === 0) {
      setState({ ok: false, message: ACCESS_MESSAGES.needDepartment });
      return;
    }
    startTransition(async () => {
      // Önce profil ve rol; kullanıcı rolündeyse ardından üyelikler (tavan dışı izinleri sunucu da atar) ve izinler.
      let result: ActionResult<unknown> = await updateUserAction({
        id: user.id,
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        role,
        phone: String(data.get("phone") ?? ""),
        position: String(data.get("position") ?? ""),
      });
      if (result.ok && withDepartments) {
        const memberships = await setUserMembershipsAction({ id: user.id, memberships: access.memberships });
        result = memberships.ok ? await setPermissionsAction({ id: user.id, permissions: access.grants }) : memberships;
      }
      setState(toFormState(result, UPDATED_MESSAGE));
      if (result.ok) {
        toast.success(UPDATED_MESSAGE);
        router.refresh();
        onDone?.(UPDATED_MESSAGE);
      } else {
        toast.error(result.message);
      }
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
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={SELECT_CLASS}
        >
          {legacyRole ? <option value={user.role}>{ROLE_LABELS[user.role]}</option> : null}
          {ROLE_CHOICES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
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
      {usesDepartments(role) ? <AccessFields value={access} onChange={setAccess} /> : null}
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="bg-amber-600 text-white hover:bg-amber-700">
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        {state && !state.ok ? <FormStatus state={state} /> : null}
      </div>
    </form>
  );
}
