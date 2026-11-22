"use client";

import { Button } from "@/components/ui/button";
import { AssignmentRow, ASSIGNMENT_TYPE_LABELS } from "./assignment-row";
import { AutoAssignPanel } from "./auto-assign-panel";
import { EmptyState, Section } from "./bits";
import { useOrganization, type DraftAssignment } from "./store";

const TYPES: DraftAssignment["assignmentType"][] = ["table", "special_task", "service_point"];

/** Adım 3: masa, özel görev ve servis noktası atamaları (aynı personel aynı vardiyaya bir kez). */
export function AssignmentsStep({ readOnly }: { readOnly: boolean }) {
  const assignments = useOrganization((s) => s.assignments);
  const hasStaff = useOrganization((s) => s.reference.staff.length > 0);
  const add = useOrganization((s) => s.addAssignment);

  return (
    <div className="space-y-4">
      {readOnly || !hasStaff ? null : <AutoAssignPanel />}
      {TYPES.map((type) => {
        const rows = assignments.filter((a) => a.assignmentType === type);
        return (
          <Section
            key={type}
            title={`${ASSIGNMENT_TYPE_LABELS[type]} atamaları (${rows.length})`}
            actions={
              readOnly || !hasStaff ? null : (
                <Button size="sm" variant="outline" onClick={() => add(type)}>
                  Ekle
                </Button>
              )
            }
          >
            {rows.length === 0 ? (
              <EmptyState>{hasStaff ? "Atama yok." : "Aktif personel yok; önce personel ekleyin."}</EmptyState>
            ) : (
              <ul className="space-y-2">
                {rows.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} readOnly={readOnly} />
                ))}
              </ul>
            )}
          </Section>
        );
      })}
    </div>
  );
}
