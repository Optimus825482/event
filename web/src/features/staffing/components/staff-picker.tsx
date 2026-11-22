"use client";

import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Availability, StaffPick } from "../group-staff";
import type { RoleRequirement } from "../service-point-roles";
import { NativeSelect, hhmm, orNull } from "./bits";
import { CustomTimeField } from "./custom-time-field";
import { RoleField } from "./role-field";
import { useOrganization } from "./store";

const NO_ROLES: RoleRequirement[] = [];

const MAX_LISTED = 40;

/**
 * Pencerelerdeki "personel ekle" bölümü: vardiya ve görev seçilir, personel aranır; her satırda
 * eklenebilirlik (`availability`) gösterilir, eklenemeyen personelin düğmesi kapalıdır.
 * `roles` verilirse görev yalnızca o rollerden seçilir. Saat vardiyadan gelir (özel saat satırda).
 */
export function StaffPicker({
  availability,
  onPick,
  defaultRole = "",
  roles = NO_ROLES,
}: {
  availability: (pick: Pick<StaffPick, "staffId" | "shiftId">) => Availability;
  onPick: (pick: StaffPick) => void;
  defaultRole?: string;
  roles?: readonly RoleRequirement[];
}) {
  const { staff, shifts } = useOrganization((s) => s.reference);
  const [query, setQuery] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [chosenRole, setRole] = useState<string | null>(orNull(defaultRole));
  // Rol listesi varsa geçerli bir seçim olmalı: liste değişip seçim düşerse ilk rol kullanılır.
  const role = roles.length === 0 || roles.some((r) => r.role === chosenRole) ? chosenRole : (roles[0]?.role ?? null);
  const q = query.trim().toLocaleLowerCase("tr");
  const matches = staff.filter(
    (p) => !q || p.fullName.toLocaleLowerCase("tr").includes(q) || p.sicilNo.toLocaleLowerCase("tr").includes(q),
  );

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            aria-label="Personel ara"
            placeholder="Ad ya da sicil no"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <NativeSelect aria-label="Eklenecek vardiya" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          <option value="">Vardiyasız</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({hhmm(s.startTime)}–{hhmm(s.endTime)})
            </option>
          ))}
        </NativeSelect>
        <RoleField label="Eklenecek görev" value={role} roles={roles} onChange={setRole} />
      </div>
      {staff.length === 0 ? (
        <p className="text-xs text-slate-400">Aktif personel yok.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Eklenebilecek personel">
          {matches.slice(0, MAX_LISTED).map((p) => {
            const a = availability({ staffId: p.id, shiftId: shiftId || null });
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-700/50">
                <span className="flex-1 text-slate-200">
                  {p.fullName} <span className="text-xs text-slate-500">({p.sicilNo})</span>
                </span>
                {a.ok ? null : <span className="text-xs text-slate-400">{a.reason}</span>}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!a.ok}
                  aria-label={`${p.fullName} ekle`}
                  onClick={() =>
                    onPick({
                      staffId: p.id,
                      shiftId: shiftId || null,
                      role,
                      shiftStart: null,
                      shiftEnd: null,
                    })
                  }
                >
                  <UserPlus aria-hidden className="size-4" />
                  Ekle
                </Button>
              </li>
            );
          })}
          {matches.length === 0 ? <li className="px-2 text-xs text-slate-400">Eşleşen personel yok.</li> : null}
          {matches.length > MAX_LISTED ? (
            <li className="px-2 text-xs text-slate-400">İlk {MAX_LISTED} kişi gösteriliyor; aramayı daraltın.</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

/** Atanmış personel satırı: ad, vardiya, düzenlenebilir görev, özel saat ve çıkarma düğmesi. */
export function AssignedStaffRow({
  assignment,
  readOnly,
  note,
  roles = NO_ROLES,
  onRemove,
}: {
  assignment: { id: string; staffId: string; shiftId: string | null; role: string | null; shiftStart: string | null; shiftEnd: string | null };
  readOnly: boolean;
  note?: string;
  roles?: readonly RoleRequirement[];
  onRemove: () => void;
}) {
  const { staff, shifts } = useOrganization((s) => s.reference);
  const update = useOrganization((s) => s.updateAssignment);
  const person = staff.find((p) => p.id === assignment.staffId);
  const shift = shifts.find((s) => s.id === assignment.shiftId);
  const name = person?.fullName ?? "Aktif olmayan personel";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-slate-700 px-2 py-1.5 text-sm">
      <span className="min-w-32 flex-1 text-slate-100">
        {name}
        <span className="block text-xs text-slate-400">
          {shift ? `${shift.name} (${hhmm(shift.startTime)}–${hhmm(shift.endTime)})` : "Vardiyasız"}
          {note ? ` · ${note}` : ""}
        </span>
      </span>
      <RoleField
        label={`${name} görevi`}
        placeholder="Görev"
        className="h-8 w-36"
        value={assignment.role}
        roles={roles}
        disabled={readOnly}
        onChange={(role) => update(assignment.id, { role })}
      />
      {readOnly ? null : (
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`${name} çıkar`}>
          Çıkar
        </Button>
      )}
      <div className="basis-full">
        <CustomTimeField assignment={assignment} readOnly={readOnly} />
      </div>
    </li>
  );
}
