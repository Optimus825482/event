"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { servicePointAssignments, servicePointAvailability, servicePointTypeLabel, staffingLabel } from "../group-staff";
import { isRoleAllowed } from "../service-point-roles";
import { EmptyState, Section, Swatch } from "./bits";
import { hasShortRole, PointRolesEditor } from "./point-roles-editor";
import { usePointRoles } from "./role-field";
import { AssignedStaffRow, StaffPicker } from "./staff-picker";
import { useOrganization, type DraftAssignment } from "./store";

type ServicePoint = ReturnType<typeof useServicePoints>[number];

function useServicePoints() {
  return useOrganization((s) => s.reference.servicePoints);
}

/** Eski "servis noktası personeli" penceresi: noktaya servis noktası ataması ekler / çıkarır. */
export function ServicePointStaffDialog({ point, readOnly }: { point: ServicePoint; readOnly: boolean }) {
  const assignments = useOrganization((s) => s.assignments);
  const addStaff = useOrganization((s) => s.addServicePointStaff);
  const remove = useOrganization((s) => s.removeAssignment);
  const roles = usePointRoles(point.id);
  const rows = servicePointAssignments(assignments, point.id);
  const short = (point.requiredStaffCount > 0 && rows.length < point.requiredStaffCount) || hasShortRole(roles, rows);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`${point.name} personeli`}>
          <MapPin aria-hidden className="size-4" />
          Personel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swatch color={point.color} />
            {point.name} — Personel
          </DialogTitle>
          <DialogDescription>
            {servicePointTypeLabel(point.pointType)} · Atanan {staffingLabel(rows.length, point.requiredStaffCount)}
            {short ? " · gerekli sayıya ulaşılmadı" : ""}
          </DialogDescription>
        </DialogHeader>
        <PointRolesEditor servicePointId={point.id} assignments={rows} readOnly={readOnly} />
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-white">Atanan personel ({rows.length})</h3>
          {rows.length === 0 ? (
            <EmptyState>Bu noktaya atanmış personel yok.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((a) => (
                <AssignedStaffRow
                  key={a.id}
                  assignment={a}
                  readOnly={readOnly}
                  roles={roles}
                  note={isRoleAllowed(roles, a.role) ? undefined : "görevi bu noktada izinli değil"}
                  onRemove={() => remove(a.id)}
                />
              ))}
            </ul>
          )}
        </section>
        {readOnly ? null : (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-white">Personel ekle</h3>
            <StaffPicker
              roles={roles}
              availability={(pick) => servicePointAvailability(assignments, pick, point.id)}
              onPick={(pick) => addStaff(point.id, pick)}
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Personel Atama adımında servis noktası kartları (doluluk + personel penceresi). */
export function ServicePointsSection({ readOnly }: { readOnly: boolean }) {
  const points = useServicePoints();
  const assignments = useOrganization((s) => s.assignments);
  if (points.length === 0) return null;
  return (
    <Section title={`Servis noktaları (${points.length})`}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => (
          <ServicePointCard key={p.id} point={p} assignments={assignments} readOnly={readOnly} />
        ))}
      </ul>
    </Section>
  );
}

function ServicePointCard({
  point: p,
  assignments,
  readOnly,
}: {
  point: ServicePoint;
  assignments: readonly DraftAssignment[];
  readOnly: boolean;
}) {
  const roles = usePointRoles(p.id);
  const rows = servicePointAssignments(assignments, p.id);
  const short = (p.requiredStaffCount > 0 && rows.length < p.requiredStaffCount) || hasShortRole(roles, rows);
  return (
    <li className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 text-sm">
      <Swatch color={p.color} />
      <span className="flex-1 text-slate-100">
        {p.name}
        <span className="block text-xs text-slate-400">
          {servicePointTypeLabel(p.pointType)}
          {roles.length > 0 ? ` · ${roles.length} görev` : ""}
        </span>
      </span>
      <Badge variant={short ? "destructive" : "secondary"}>{staffingLabel(rows.length, p.requiredStaffCount)}</Badge>
      <ServicePointStaffDialog point={p} readOnly={readOnly} />
    </li>
  );
}
