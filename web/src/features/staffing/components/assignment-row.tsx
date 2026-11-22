"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, NativeSelect, hhmm, orNull } from "./bits";
import { CustomTimeField } from "./custom-time-field";
import { RoleField, usePointRoles } from "./role-field";
import { useOrganization, type DraftAssignment } from "./store";

export const ASSIGNMENT_TYPE_LABELS: Record<DraftAssignment["assignmentType"], string> = {
  table: "Masa",
  special_task: "Özel görev",
  service_point: "Servis noktası",
};

/** Tek atama satırı: personel, vardiya, ekip ve türe özgü alanlar. */
export function AssignmentRow({ assignment, readOnly }: { assignment: DraftAssignment; readOnly: boolean }) {
  const { staff, shifts, servicePoints, tables } = useOrganization((s) => s.reference);
  const teams = useOrganization((s) => s.teams);
  const update = useOrganization((s) => s.updateAssignment);
  const remove = useOrganization((s) => s.removeAssignment);
  const toggleTable = useOrganization((s) => s.toggleAssignmentTable);
  const [showTables, setShowTables] = useState(false);
  const a = assignment;
  const pointRoles = usePointRoles(a.assignmentType === "service_point" ? a.servicePointId : null);
  const patch = (p: Partial<DraftAssignment>) => update(a.id, p);

  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <NativeSelect
          aria-label="Personel"
          value={a.staffId}
          disabled={readOnly}
          onChange={(e) => patch({ staffId: e.target.value })}
        >
          {staff.some((p) => p.id === a.staffId) ? null : <option value={a.staffId}>Aktif olmayan personel</option>}
          {staff.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} ({p.sicilNo})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Atama türü"
          value={a.assignmentType}
          disabled={readOnly}
          onChange={(e) => {
            const type = e.target.value as DraftAssignment["assignmentType"];
            patch({ assignmentType: type, servicePointId: type === "service_point" ? (servicePoints[0]?.id ?? null) : null });
          }}
        >
          {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Vardiya"
          value={a.shiftId ?? ""}
          disabled={readOnly}
          onChange={(e) => patch({ shiftId: e.target.value || null })}
        >
          <option value="">Vardiyasız</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({hhmm(s.startTime)}–{hhmm(s.endTime)})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Ekip"
          value={a.teamId ?? ""}
          disabled={readOnly}
          onChange={(e) => patch({ teamId: e.target.value || null })}
        >
          <option value="">Ekip yok</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        <RoleField label="Görev / rol" value={a.role} roles={pointRoles} disabled={readOnly} onChange={(role) => patch({ role })} />
      </div>
      {a.assignmentType === "special_task" ? null : <CustomTimeField assignment={a} readOnly={readOnly} />}

      {a.assignmentType === "table" ? (
        <div className="space-y-2">
          <Button size="sm" variant="ghost" onClick={() => setShowTables((v) => !v)} aria-expanded={showTables}>
            Masalar: {a.tableIds.length === 0 ? "yok" : tables.filter((t) => a.tableIds.includes(t.id)).map((t) => t.label).join(", ")}
          </Button>
          {showTables ? (
            <div className="flex flex-wrap gap-1.5">
              {tables.map((t) => (
                <Chip
                  key={t.id}
                  active={a.tableIds.includes(t.id)}
                  disabled={readOnly}
                  onClick={() => toggleTable(a.id, t.id)}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {a.assignmentType === "special_task" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            aria-label="Görev yeri"
            placeholder="Görev yeri (ör. vestiyer)"
            value={a.specialTaskLocation ?? ""}
            disabled={readOnly}
            onChange={(e) => patch({ specialTaskLocation: orNull(e.target.value) })}
          />
          <Input
            type="time"
            aria-label="Görev başlangıcı"
            value={hhmm(a.specialTaskStartTime)}
            disabled={readOnly}
            onChange={(e) => patch({ specialTaskStartTime: orNull(e.target.value) })}
          />
          <Input
            type="time"
            aria-label="Görev bitişi"
            value={hhmm(a.specialTaskEndTime)}
            disabled={readOnly}
            onChange={(e) => patch({ specialTaskEndTime: orNull(e.target.value) })}
          />
        </div>
      ) : null}

      {a.assignmentType === "service_point" ? (
        servicePoints.length === 0 ? (
          <p className="text-xs text-destructive">Bu etkinlikte servis noktası yok.</p>
        ) : (
          <NativeSelect
            aria-label="Servis noktası"
            className="max-w-xs"
            value={a.servicePointId ?? ""}
            disabled={readOnly}
            onChange={(e) => patch({ servicePointId: e.target.value || null })}
          >
            <option value="">Servis noktası seçin</option>
            {servicePoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )
      ) : null}

      {readOnly ? null : (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
            Atamayı kaldır
          </Button>
        </div>
      )}
    </li>
  );
}
