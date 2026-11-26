"use client";

import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { groupStaffAssignments, groupStaffAvailability } from "../group-staff";
import { Chip, EmptyState, Swatch } from "./bits";
import { GroupSupervisorField } from "./group-supervisor-field";
import { AssignedStaffRow, StaffPicker } from "./staff-picker";
import { useOrganization, type DraftGroup } from "./store";

/**
 * Eski "grup personel seçimi" penceresi. Personel, grubun masalarını kapsayan masa atamasıyla
 * gruba bağlanır (ayrı bir grup-personel kaydı yoktur); ekstra personel grup bağıyla seçilir.
 */
export function GroupStaffDialog({ group, readOnly }: { group: DraftGroup; readOnly: boolean }) {
  const assignments = useOrganization((s) => s.assignments);
  const tables = useOrganization((s) => s.reference.tables);
  const reviewHints = useOrganization((s) => s.reference.reviewHints);
  const extraStaff = useOrganization((s) => s.extraStaff);
  const addGroupStaff = useOrganization((s) => s.addGroupStaff);
  const removeGroupStaff = useOrganization((s) => s.removeGroupStaff);
  const toggleExtraGroup = useOrganization((s) => s.toggleExtraGroup);
  const rows = groupStaffAssignments(assignments, group);
  const linkedExtras = extraStaff.filter((e) => e.groupIds.includes(group.id));
  const labels = tables.filter((t) => group.tableIds.includes(t.id)).map((t) => t.label);
  const name = group.name || "Adsız grup";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`${name} personeli`}>
          <UserCog aria-hidden className="size-4" />
          {rows.length + linkedExtras.length}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swatch color={group.color} />
            {name} — Personel seçimi
          </DialogTitle>
          <DialogDescription>
            {labels.length === 0 ? "Grupta masa yok; önce planda masa ekleyin." : `Masalar: ${labels.join(", ")}`}
          </DialogDescription>
        </DialogHeader>

        <GroupSupervisorField groupId={group.id} readOnly={readOnly} />

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-white">Atanan personel ({rows.length})</h3>
          {rows.length === 0 ? (
            <EmptyState>Bu grubun masalarına atanmış personel yok.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((a) => {
                const outside = a.tableIds.filter((t) => !group.tableIds.includes(t)).length;
                const missing = group.tableIds.filter((t) => !a.tableIds.includes(t)).length;
                const note = [outside > 0 ? `+${outside} başka masa` : null, missing > 0 ? `${missing} masası eksik` : null]
                  .filter((x): x is string => x !== null)
                  .join(", ");
                return (
                  <AssignedStaffRow
                    key={a.id}
                    assignment={a}
                    readOnly={readOnly}
                    note={note || undefined}
                    onRemove={() => removeGroupStaff(group.id, a.id)}
                  />
                );
              })}
            </ul>
          )}
        </section>

        {readOnly ? null : (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-white">Personel ekle</h3>
            <StaffPicker
              hints={reviewHints}
              defaultRole="Garson"
              availability={(pick) => groupStaffAvailability(assignments, pick, group)}
              onPick={(pick) => addGroupStaff(group.id, pick)}
            />
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-white">Ekstra personel</h3>
          {extraStaff.length === 0 ? (
            <p className="text-xs text-slate-400">Ekstra personel yok; &quot;Ekstra Personel&quot; adımında ekleyebilirsiniz.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" aria-label="Gruba bağlı ekstra personel">
              {extraStaff.map((e) => (
                <Chip
                  key={e.id}
                  active={e.groupIds.includes(group.id)}
                  color={group.color}
                  disabled={readOnly}
                  onClick={() => toggleExtraGroup(e.id, group.id)}
                >
                  {e.fullName || "Adsız"}
                </Chip>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
