"use client";

import type { Membership } from "@/features/auth/departments";
import type { PermissionRow, Verb } from "@/features/auth/policy";
import { permissionGrid, VERB_FLAGS } from "../form-model";

type Flag = (typeof VERB_FLAGS)[number][1];

const EMPTY = { canView: false, canCreate: false, canEdit: false, canDelete: false } as const;

/**
 * Kullanıcıya verilen modül izinleri (denetimli bileşen). Tablo yalnızca `Kullanıcı` düzeyindeki
 * üyeliklerin tavanını gösterir; yönetici/asistan düzeyi için salt-okunur açıklama yazılır.
 * İşaretli kutu verilen yetkidir; tavan dışındaki fiilin kutusu gösterilmez.
 */
export function PermissionsForm({
  memberships,
  value,
  onChange,
}: {
  memberships: Membership[];
  value: PermissionRow[];
  onChange: (next: PermissionRow[]) => void;
}) {
  const grid = permissionGrid(memberships);
  const hasElevated = memberships.some((m) => m.level !== "member");

  function setFlag(module: PermissionRow["module"], flag: Flag, checked: boolean) {
    const current = value.find((row) => row.module === module) ?? { module, ...EMPTY };
    let next: PermissionRow = { ...current, [flag]: checked };
    // Görüntüleme kapanınca satırın tamamı kapanır; başka bir kutu açılınca görüntüleme açılır.
    if (flag === "canView" && !checked) next = { module, ...EMPTY };
    else if (checked) next = { ...next, canView: true };
    const rest = value.filter((row) => row.module !== module);
    onChange(next.canView ? [...rest, next] : rest);
  }

  return (
    <div className="min-w-0 space-y-3">
      {hasElevated ? (
        <p className="text-sm text-muted-foreground">Departmanın tüm modülleri (asistan: silme hariç)</p>
      ) : null}
      {grid.length > 0 ? (
        <div className="overflow-x-auto">
          <p className="mb-1 text-sm font-medium">İzin ver</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Modül</th>
                {VERB_FLAGS.map(([, , label]) => (
                  <th key={label} className="py-2 pr-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map(({ module, label, verbs }) => {
                const row = value.find((r) => r.module === module);
                return (
                  <tr key={module} className="border-b last:border-0">
                    <td className="py-2 pr-4">{label}</td>
                    {VERB_FLAGS.map(([verb, flag, verbLabel]) => (
                      <td key={verb} className="py-0 pr-4">
                        {(verbs as Verb[]).includes(verb) ? (
                          <span className="flex h-11 w-11 items-center justify-center">
                            <input
                              type="checkbox"
                              aria-label={`${label}: ${verbLabel}`}
                              checked={row?.[flag] ?? false}
                              onChange={(e) => setFlag(module, flag, e.target.checked)}
                            />
                          </span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
