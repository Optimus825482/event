"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_ROLE_COUNT,
  MAX_ROLES_PER_POINT,
  normalizeRole,
  roleCoverage,
  SERVICE_POINT_ROLE_OPTIONS,
  type RoleRequirement,
} from "../service-point-roles";
import { usePointRoles } from "./role-field";
import { useOrganization } from "./store";

/** Rol başına gereken sayısı karşılanmamış rol var mı. */
export function hasShortRole(roles: readonly RoleRequirement[], assignments: ReadonlyArray<{ role: string | null }>): boolean {
  return roleCoverage(roles, assignments).rows.some((r) => r.required > 0 && r.assigned < r.required);
}

/**
 * Servis noktası penceresinde "Görevler": izinli roller, rol başına gereken sayı ve atanan / gereken.
 * Liste boşsa noktada her görev çalışabilir. Değişiklikler taslağa yazılır (geri al / yinele kapsamında).
 */
export function PointRolesEditor({
  servicePointId,
  assignments,
  readOnly,
}: {
  servicePointId: string;
  assignments: ReadonlyArray<{ role: string | null }>;
  readOnly: boolean;
}) {
  const roles = usePointRoles(servicePointId);
  const setRoles = useOrganization((s) => s.setPointRoles);
  const [custom, setCustom] = useState("");
  const coverage = roleCoverage(roles, assignments);
  const free = SERVICE_POINT_ROLE_OPTIONS.filter((o) => !roles.some((r) => r.role === o.value));
  const full = roles.length >= MAX_ROLES_PER_POINT;

  const add = (raw: string) => {
    const role = normalizeRole(raw);
    if (role === null || roles.some((r) => r.role === role) || full) return;
    setRoles(servicePointId, [...roles, { role, requiredCount: 1 }]);
  };
  const setCount = (role: string, value: string) => {
    const n = Math.min(MAX_ROLE_COUNT, Math.max(0, Math.trunc(Number(value) || 0)));
    setRoles(
      servicePointId,
      roles.map((r) => (r.role === role ? { ...r, requiredCount: n } : r)),
      `${role}:count`,
    );
  };

  return (
    <section className="space-y-2" aria-label="Görevler">
      <h3 className="text-sm font-medium text-white">Görevler</h3>
      {roles.length === 0 ? (
        <p className="text-xs text-slate-400">Görev tanımlı değil: bu noktada her görevden personel çalışabilir.</p>
      ) : (
        <ul className="space-y-1.5">
          {coverage.rows.map((r) => {
            const short = r.required > 0 && r.assigned < r.required;
            return (
              <li key={r.role} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-700 px-2 py-1.5 text-sm">
                <span className="min-w-28 flex-1 text-slate-100">{r.label}</span>
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  Gerekli
                  <Input
                    type="number"
                    min={0}
                    max={MAX_ROLE_COUNT}
                    aria-label={`${r.label} gerekli sayı`}
                    className="h-8 w-20"
                    value={r.required}
                    disabled={readOnly}
                    onChange={(e) => setCount(r.role, e.target.value)}
                  />
                </label>
                <Badge variant={short ? "destructive" : "secondary"} aria-label={`${r.label} atanan / gereken`}>
                  {r.required > 0 ? `${r.assigned} / ${r.required}` : `${r.assigned} (sayı yok)`}
                </Badge>
                {readOnly ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${r.label} görevini kaldır`}
                    onClick={() => setRoles(servicePointId, roles.filter((x) => x.role !== r.role))}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {coverage.other > 0 && roles.length > 0 ? (
        <p role="alert" className="text-xs text-destructive">
          {coverage.other} personelin görevi bu noktanın görevleri arasında değil; kayıt reddedilir.
        </p>
      ) : null}
      {readOnly || full ? null : (
        <div className="flex flex-wrap items-center gap-1.5">
          {free.map((o) => (
            <Button key={o.value} size="sm" variant="outline" onClick={() => add(o.value)} aria-label={`${o.label} görevi ekle`}>
              <Plus aria-hidden className="size-3" />
              {o.label}
            </Button>
          ))}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              add(custom);
              setCustom("");
            }}
          >
            <Input
              aria-label="Yeni görev adı"
              placeholder="Başka görev"
              className="h-8 w-36"
              maxLength={50}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={normalizeRole(custom) === null}>
              Ekle
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
