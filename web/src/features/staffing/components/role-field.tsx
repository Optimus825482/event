"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isRoleAllowed, normalizeRole, roleLabel, type RoleRequirement } from "../service-point-roles";
import { NativeSelect, orNull } from "./bits";
import { useOrganization } from "./store";

const NO_ROLES: RoleRequirement[] = [];

/** Servis noktasının taslaktaki rol listesi (rol tanımlı değilse boş, sabit referans). */
export function usePointRoles(servicePointId: string | null | undefined): RoleRequirement[] {
  return useOrganization(
    (s) => s.servicePointRoles.find((p) => p.servicePointId === servicePointId)?.roles ?? NO_ROLES,
  );
}

/**
 * Görev alanı: rol listesi verilmişse yalnızca o rollerden seçilir (izinli olmayan mevcut değer
 * uyarıyla gösterilir); liste boşsa serbest metindir.
 */
export function RoleField({
  value,
  onChange,
  roles,
  label,
  placeholder = "Görev (ör. garson)",
  disabled,
  className,
}: {
  value: string | null;
  onChange: (role: string | null) => void;
  roles: readonly RoleRequirement[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  if (roles.length === 0) {
    return (
      <Input
        aria-label={label}
        placeholder={placeholder}
        className={className}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(orNull(e.target.value))}
      />
    );
  }
  const allowed = isRoleAllowed(roles, value);
  const current = normalizeRole(value);
  return (
    <NativeSelect
      aria-label={label}
      aria-invalid={!allowed}
      className={cn(className, allowed ? undefined : "border-destructive")}
      value={allowed ? (current ?? "") : (value ?? "")}
      disabled={disabled}
      onChange={(e) => onChange(orNull(e.target.value))}
    >
      {allowed ? null : <option value={value ?? ""}>{value ? `${value} (izinli değil)` : "Görev seçin"}</option>}
      {roles.map((r) => (
        <option key={r.role} value={r.role}>
          {roleLabel(r.role)}
        </option>
      ))}
    </NativeSelect>
  );
}
