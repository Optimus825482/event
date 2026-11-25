"use client";

import {
  DEPARTMENT_LABELS,
  DEPARTMENT_LEVELS,
  DEPARTMENTS,
  LEVEL_LABELS,
  type Department,
  type DepartmentLevel,
  type Membership,
} from "@/features/auth/departments";
import type { PermissionRow } from "@/features/auth/policy";
import { pruneGrants } from "../form-model";
import { SELECT_CLASS } from "./field";
import { PermissionsForm } from "./permissions-form";

/** Departman başına bir satır: onay kutusu + düzey seçimi. Sıra `DEPARTMENTS` sırasıdır. */
export function MembershipFields({
  value,
  onChange,
}: {
  value: Membership[];
  onChange: (next: Membership[]) => void;
}) {
  function toggle(department: Department, enabled: boolean) {
    if (!enabled) return onChange(value.filter((m) => m.department !== department));
    const next = [...value, { department, level: "member" as DepartmentLevel }];
    onChange(DEPARTMENTS.flatMap((d) => next.filter((m) => m.department === d)));
  }

  function setLevel(department: Department, level: DepartmentLevel) {
    onChange(value.map((m) => (m.department === department ? { ...m, level } : m)));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium">Departmanlar</legend>
      {DEPARTMENTS.map((department) => {
        const membership = value.find((m) => m.department === department);
        return (
          <div key={department} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex min-w-0 items-center gap-2 text-sm sm:w-48">
              <input
                type="checkbox"
                checked={membership !== undefined}
                onChange={(e) => toggle(department, e.target.checked)}
              />
              {DEPARTMENT_LABELS[department]}
            </label>
            <select
              aria-label={`${DEPARTMENT_LABELS[department]} düzeyi`}
              value={membership?.level ?? "member"}
              disabled={membership === undefined}
              onChange={(e) => setLevel(department, e.target.value as DepartmentLevel)}
              className={`${SELECT_CLASS} sm:w-52`}
            >
              {DEPARTMENT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}

export type AccessValue = { memberships: Membership[]; grants: PermissionRow[] };

/** Üyelikler ve izin tablosu birlikte: üyelik değişince tavan dışı izinler atılır. */
export function AccessFields({ value, onChange }: { value: AccessValue; onChange: (next: AccessValue) => void }) {
  return (
    <div className="space-y-4 sm:col-span-2">
      <MembershipFields
        value={value.memberships}
        onChange={(memberships) => onChange({ memberships, grants: pruneGrants(value.grants, memberships) })}
      />
      <PermissionsForm
        memberships={value.memberships}
        value={value.grants}
        onChange={(grants) => onChange({ ...value, grants })}
      />
    </div>
  );
}
