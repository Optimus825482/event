import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventExtraStaff,
  eventExtraStaffGroups,
  eventExtraStaffTables,
  eventStaffAssignments,
  eventTables,
  servicePoints,
  tableGroupTables,
  tableGroups,
  teamMembers,
  teams,
  workShifts,
} from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { listActiveStaff } from "@/features/staff/service";
import { getReadableEvent, withEventWrite } from "./access";
import { applyAssignments, type SavedAssignment } from "./assignments-service";
import { applyExtraStaff, type SavedExtraStaff } from "./extra-staff-service";
import { applyGroups, type SavedGroup } from "./groups-service";
import type { SaveOrganizationInput } from "./schemas";
import { applyServicePointRoles, loadServicePointRoles } from "./service-point-roles-service";
import { applyTeams, type SavedTeam } from "./teams-service";

/**
 * Sihirbazın tamamını tek transaction'da kaydeder: ekipler → gruplar → servis noktası rolleri →
 * atamalar (rol denetimi yeni rollerle) → ekstra personel. Yeni ekip/grup için istemcinin ürettiği kimlik aynı kayıtta referans verilebilir.
 * Herhangi bir adımda hata olursa önceki adımlar da geri alınır.
 */
export async function saveOrganization(
  db: Db | Tx,
  actor: Actor,
  input: SaveOrganizationInput,
): Promise<{ teams: SavedTeam[]; groups: SavedGroup[]; assignments: SavedAssignment[]; extraStaff: SavedExtraStaff[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const savedTeams = await applyTeams(tx, input.eventId, input.teams);
    const groups = await applyGroups(tx, input.eventId, input.groups);
    await applyServicePointRoles(tx, input.eventId, input.servicePointRoles ?? []);
    const assignments = await applyAssignments(tx, input.eventId, input.assignments);
    const extraStaff = await applyExtraStaff(tx, input.eventId, input.extraStaff ?? []);
    return { teams: savedTeams, groups, assignments, extraStaff };
  });
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/** Sihirbazın ihtiyaç duyduğu tüm okuma (yetki ve etkinlik varlığı ilk satırda). */
export async function getOrganization(db: Db | Tx, actor: Actor, eventId: string) {
  const event = await getReadableEvent(db, actor, eventId);

  const [tables, teamRows, groupRows, assignmentRows, extraRows, points, shifts, activeStaff, pointRoles] = await Promise.all([
    db
      .select({
        id: eventTables.id,
        label: eventTables.label,
        capacity: eventTables.capacity,
        x: eventTables.x,
        y: eventTables.y,
        isLoca: eventTables.isLoca,
      })
      .from(eventTables)
      .where(eq(eventTables.eventId, eventId))
      .orderBy(asc(eventTables.label)),
    db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(asc(teams.sortOrder), asc(teams.name)),
    db
      .select()
      .from(tableGroups)
      .where(eq(tableGroups.eventId, eventId))
      .orderBy(asc(tableGroups.sortOrder), asc(tableGroups.name)),
    db
      .select()
      .from(eventStaffAssignments)
      .where(eq(eventStaffAssignments.eventId, eventId))
      .orderBy(asc(eventStaffAssignments.sortOrder), asc(eventStaffAssignments.createdAt)),
    db
      .select()
      .from(eventExtraStaff)
      .where(eq(eventExtraStaff.eventId, eventId))
      .orderBy(asc(eventExtraStaff.sortOrder), asc(eventExtraStaff.fullName)),
    db
      .select({
        id: servicePoints.id,
        name: servicePoints.name,
        pointType: servicePoints.pointType,
        requiredStaffCount: servicePoints.requiredStaffCount,
        color: servicePoints.color,
      })
      .from(servicePoints)
      .where(and(eq(servicePoints.eventId, eventId), eq(servicePoints.isActive, true)))
      .orderBy(asc(servicePoints.sortOrder), asc(servicePoints.name)),
    db
      .select({
        id: workShifts.id,
        name: workShifts.name,
        startTime: workShifts.startTime,
        endTime: workShifts.endTime,
        color: workShifts.color,
      })
      .from(workShifts)
      .where(and(eq(workShifts.isActive, true), or(isNull(workShifts.eventId), eq(workShifts.eventId, eventId))))
      .orderBy(asc(workShifts.sortOrder), asc(workShifts.name)),
    listActiveStaff(db, {}),
    loadServicePointRoles(db, eventId),
  ]);

  const teamIds = teamRows.map((t) => t.id);
  const [members, groupLinks, assignmentLinks, extraTableLinks, extraGroupLinks] = await Promise.all([
    teamIds.length > 0 ? db.select().from(teamMembers).where(inArray(teamMembers.teamId, teamIds)) : Promise.resolve([]),
    db.select().from(tableGroupTables).where(eq(tableGroupTables.eventId, eventId)),
    db.select().from(assignmentTables).where(eq(assignmentTables.eventId, eventId)),
    db.select().from(eventExtraStaffTables).where(eq(eventExtraStaffTables.eventId, eventId)),
    db.select().from(eventExtraStaffGroups).where(eq(eventExtraStaffGroups.eventId, eventId)),
  ]);

  const membersByTeam = groupBy(members, (m) => m.teamId);
  const tablesByGroup = groupBy(groupLinks, (l) => l.tableGroupId);
  const tablesByAssignment = groupBy(assignmentLinks, (l) => l.assignmentId);
  const tablesByExtra = groupBy(extraTableLinks, (l) => l.extraStaffId);
  const groupsByExtra = groupBy(extraGroupLinks, (l) => l.extraStaffId);

  return {
    event: { id: event.id, name: event.name, status: event.status, startsAt: event.startsAt },
    editable: event.status !== "completed" && event.status !== "cancelled",
    tables,
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      leaderStaffId: t.leaderStaffId,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      members: (membersByTeam.get(t.id) ?? []).map((m) => ({
        staffId: m.staffId,
        isLeader: m.isLeader,
        role: m.role,
        shiftStart: m.shiftStart,
        shiftEnd: m.shiftEnd,
      })),
    })),
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      teamId: g.teamId,
      supervisorStaffId: g.supervisorStaffId,
      groupType: g.groupType,
      sortOrder: g.sortOrder,
      notes: g.notes,
      tableIds: (tablesByGroup.get(g.id) ?? []).map((l) => l.tableId),
    })),
    assignments: assignmentRows.map((a) => ({
      id: a.id,
      staffId: a.staffId,
      shiftId: a.shiftId,
      teamId: a.teamId,
      assignmentType: a.assignmentType,
      servicePointId: a.servicePointId,
      role: a.role,
      shiftStart: a.shiftStart,
      shiftEnd: a.shiftEnd,
      specialTaskLocation: a.specialTaskLocation,
      specialTaskStartTime: a.specialTaskStartTime,
      specialTaskEndTime: a.specialTaskEndTime,
      color: a.color,
      notes: a.notes,
      sortOrder: a.sortOrder,
      tableIds: (tablesByAssignment.get(a.id) ?? []).map((l) => l.tableId),
    })),
    extraStaff: extraRows.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      position: e.position,
      role: e.role,
      shiftStart: e.shiftStart,
      shiftEnd: e.shiftEnd,
      color: e.color,
      notes: e.notes,
      sortOrder: e.sortOrder,
      isActive: e.isActive,
      tableIds: (tablesByExtra.get(e.id) ?? []).map((l) => l.tableId),
      groupIds: (groupsByExtra.get(e.id) ?? []).map((l) => l.tableGroupId),
    })),
    servicePoints: points,
    /** Taslakta düzenlenir (geri al / yinele kapsamında); nokta başına rol + gereken sayı. */
    servicePointRoles: points.map((p) => ({ servicePointId: p.id, roles: pointRoles.get(p.id)?.roles ?? [] })),
    shifts,
    staff: activeStaff.map((s) => ({ id: s.id, fullName: s.fullName, sicilNo: s.sicilNo, color: s.color })),
  };
}

export type Organization = Awaited<ReturnType<typeof getOrganization>>;
