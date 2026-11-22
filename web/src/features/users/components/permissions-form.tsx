"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PermissionRow } from "@/features/auth/policy";
import { setPermissionsAction } from "../actions";
import { PERMISSION_MODULES } from "../schemas";
import { FormStatus, toFormState, type FormState } from "./field";

const MODULE_LABELS: Record<(typeof PERMISSION_MODULES)[number], string> = {
  events: "Etkinlikler",
  reservations: "Rezervasyonlar",
  check_in: "Check-in",
  staff: "Personel",
  customers: "Müşteriler",
  venues: "Mekânlar",
  settings: "Ayarlar",
  users: "Kullanıcılar",
  invitations: "Davetiyeler",
  notifications: "Bildirimler",
};

const VERBS = [
  ["canView", "Görüntüle"],
  ["canCreate", "Oluştur"],
  ["canEdit", "Düzenle"],
  ["canDelete", "Sil"],
] as const;

type Flags = Record<(typeof VERBS)[number][0], boolean>;
type Grid = Partial<Record<(typeof PERMISSION_MODULES)[number], Flags>>;

function toGrid(rows: PermissionRow[]): Grid {
  const grid: Grid = {};
  for (const row of rows) {
    if (row.module in MODULE_LABELS) {
      grid[row.module as (typeof PERMISSION_MODULES)[number]] = {
        canView: row.canView,
        canCreate: row.canCreate,
        canEdit: row.canEdit,
        canDelete: row.canDelete,
      };
    }
  }
  return grid;
}

/**
 * Modül bazlı kısıtlamalar. İşaretsiz modül = rolün varsayılan yetkisi geçerli;
 * işaretli modülde yalnızca seçilen eylemlere izin verilir (rol yetkisini genişletmez).
 */
export function PermissionsForm({ userId, initial }: { userId: string; initial: PermissionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grid, setGrid] = useState<Grid>(() => toGrid(initial));
  const [state, setState] = useState<FormState>(null);

  function toggleModule(module: keyof typeof MODULE_LABELS, enabled: boolean) {
    setGrid((prev) => {
      const next = { ...prev };
      if (enabled) next[module] = { canView: true, canCreate: false, canEdit: false, canDelete: false };
      else delete next[module];
      return next;
    });
  }

  function toggleVerb(module: keyof typeof MODULE_LABELS, verb: keyof Flags, value: boolean) {
    setGrid((prev) => {
      const current = prev[module];
      return current ? { ...prev, [module]: { ...current, [verb]: value } } : prev;
    });
  }

  function save() {
    setState(null);
    const permissions = PERMISSION_MODULES.flatMap((module) => {
      const flags = grid[module];
      return flags ? [{ module, ...flags }] : [];
    });
    startTransition(async () => {
      const result = await setPermissionsAction({ id: userId, permissions });
      setState(toFormState(result, "İzinler kaydedildi"));
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Modül</th>
              <th className="py-2 pr-4 font-medium">Kısıtla</th>
              {VERBS.map(([, label]) => (
                <th key={label} className="py-2 pr-4 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) => {
              const flags = grid[module];
              return (
                <tr key={module} className="border-b last:border-0">
                  <td className="py-2 pr-4">{MODULE_LABELS[module]}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      aria-label={`${MODULE_LABELS[module]} için kısıtlama`}
                      checked={flags !== undefined}
                      onChange={(e) => toggleModule(module, e.target.checked)}
                    />
                  </td>
                  {VERBS.map(([verb, label]) => (
                    <td key={verb} className="py-2 pr-4">
                      <input
                        type="checkbox"
                        aria-label={`${MODULE_LABELS[module]}: ${label}`}
                        disabled={flags === undefined}
                        checked={flags?.[verb] ?? false}
                        onChange={(e) => toggleVerb(module, verb, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Kaydediliyor…" : "İzinleri kaydet"}
        </Button>
        <FormStatus state={state} />
      </div>
    </div>
  );
}
