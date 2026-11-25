import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, organizationTemplates, servicePoints, staff, workShifts } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { ensureStaffingAccess, getReadableEvent, withEventWrite } from "./access";
import { applyAssignments } from "./assignments-service";
import { unique } from "./diff";
import { applyGroups } from "./groups-service";
import { getOrganization } from "./organization-service";
import { isRoleAllowed, overrideTimesError } from "./service-point-roles";
import { loadServicePointRoles } from "./service-point-roles-service";
import type { ApplyTemplateInput, AssignmentInput, CreateTemplateInput, DeleteTemplateInput, GroupInput, TeamInput } from "./schemas";
import { applyTeams } from "./teams-service";
import { templateSnapshotSchema, type TableRef, type TemplateSnapshot } from "./template-snapshot";
import { isAdmin } from "@/features/auth/scope";

const NOT_FOUND = "Şablon bulunamadı";

type OwnedTemplate = Pick<typeof organizationTemplates.$inferSelect, "createdById" | "isDefault">;

/** Yönetici hepsini; diğerleri kendi şablonlarını ve varsayılan işaretli olanları görür. */
export function canSeeOrganizationTemplate(actor: Actor, template: OwnedTemplate): boolean {
  return isAdmin(actor) || template.isDefault || template.createdById === actor.id;
}

/** Yalnızca yönetici ve sahibi siler (sahipsiz şablonu yalnızca yönetici). */
export function canManageOrganizationTemplate(actor: Actor, template: Pick<OwnedTemplate, "createdById">): boolean {
  return isAdmin(actor) || template.createdById === actor.id;
}

export type TemplateApplyReport = {
  teams: number;
  groups: number;
  assignments: number;
  /** Hedef etkinlikte kimliği ya da etiketi bulunamayan masalar (atlanır). */
  missingTables: TableRef[];
  /** Bulunamayan ya da aktif olmayan personel (atamaları/üyelikleri atlanır). */
  missingStaffIds: string[];
  /** Hedef etkinlikte kullanılamayan vardiyalar (o atamalar atlanır). */
  missingShiftIds: string[];
  /** Hedef etkinlikte adı bulunamayan servis noktaları (o atamalar atlanır). */
  missingServicePoints: string[];
  /** Görevi hedef servis noktasının izinli rolleri arasında olmadığı için atlanan atamalar ("personel @ nokta"). */
  roleMismatches: string[];
};

/** Etkinliğin mevcut organizasyonunu şablon olarak saklar (tek satır yazar). */
export async function createOrganizationTemplate(
  db: Db | Tx,
  actor: Actor,
  input: CreateTemplateInput,
): Promise<{ id: string }> {
  ensureStaffingAccess(actor, "create");
  await getReadableEvent(db, actor, input.eventId);
  const org = await getOrganization(db, actor, input.eventId);
  const labelOf = new Map(org.tables.map((t) => [t.id, t.label]));
  const refs = (ids: string[]): TableRef[] => ids.flatMap((id) => (labelOf.has(id) ? [{ id, label: labelOf.get(id) ?? "" }] : []));
  const pointName = new Map(org.servicePoints.map((p) => [p.id, p.name]));

  const snapshot: TemplateSnapshot = {
    teams: org.teams.map((t) => ({
      key: t.id,
      name: t.name,
      color: t.color,
      sortOrder: t.sortOrder,
      leaderStaffId: t.leaderStaffId,
      members: t.members,
    })),
    groups: org.groups.map((g) => ({
      name: g.name,
      color: g.color,
      groupType: g.groupType,
      sortOrder: g.sortOrder,
      notes: g.notes,
      teamKey: g.teamId,
      supervisorStaffId: g.supervisorStaffId,
      tables: refs(g.tableIds),
    })),
    assignments: org.assignments.map((a) => ({
      staffId: a.staffId,
      shiftId: a.shiftId,
      teamKey: a.teamId,
      assignmentType: a.assignmentType,
      servicePointName: a.servicePointId ? (pointName.get(a.servicePointId) ?? null) : null,
      role: a.role,
      shiftStart: a.shiftStart,
      shiftEnd: a.shiftEnd,
      specialTaskLocation: a.specialTaskLocation,
      specialTaskStartTime: a.specialTaskStartTime,
      specialTaskEndTime: a.specialTaskEndTime,
      color: a.color,
      notes: a.notes,
      sortOrder: a.sortOrder,
      tables: refs(a.tableIds),
    })),
  };

  const [row] = await db
    .insert(organizationTemplates)
    .values({
      name: input.name,
      description: input.description ?? null,
      createdById: actor.id,
      teamAssignments: snapshot.teams,
      tableGroups: snapshot.groups,
      staffAssignments: snapshot.assignments,
    })
    .returning({ id: organizationTemplates.id });
  if (!row) throw new Error("şablon eklenemedi");
  return { id: row.id };
}

export async function listOrganizationTemplates(db: Db | Tx, actor: Actor) {
  ensureStaffingAccess(actor, "view");
  const visible: SQL | undefined =
    isAdmin(actor)
      ? undefined
      : or(eq(organizationTemplates.isDefault, true), eq(organizationTemplates.createdById, actor.id));
  const rows = await db
    .select({
      id: organizationTemplates.id,
      name: organizationTemplates.name,
      description: organizationTemplates.description,
      isDefault: organizationTemplates.isDefault,
      createdById: organizationTemplates.createdById,
      createdAt: organizationTemplates.createdAt,
    })
    .from(organizationTemplates)
    .where(and(eq(organizationTemplates.isActive, true), visible))
    .orderBy(desc(organizationTemplates.isDefault), desc(organizationTemplates.createdAt));
  return rows.map(({ createdById, ...row }) => ({ ...row, canManage: canManageOrganizationTemplate(actor, { createdById }) }));
}

/** Eski davranış gibi yumuşak silme (`is_active = false`). */
export async function deleteOrganizationTemplate(db: Db | Tx, actor: Actor, input: DeleteTemplateInput): Promise<{ id: string }> {
  ensureStaffingAccess(actor, "delete");
  const [template] = await db
    .select()
    .from(organizationTemplates)
    .where(and(eq(organizationTemplates.id, input.id), eq(organizationTemplates.isActive, true)));
  if (!template || !canSeeOrganizationTemplate(actor, template)) throw new DomainError("not_found", NOT_FOUND);
  if (!canManageOrganizationTemplate(actor, template)) {
    throw new DomainError("conflict", "Yalnızca kendi şablonlarınızı silebilirsiniz");
  }
  const [row] = await db
    .update(organizationTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(organizationTemplates.id, input.id), eq(organizationTemplates.isActive, true)))
    .returning({ id: organizationTemplates.id });
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

async function loadSnapshot(tx: Tx, actor: Actor, templateId: string): Promise<TemplateSnapshot> {
  const [template] = await tx
    .select()
    .from(organizationTemplates)
    .where(and(eq(organizationTemplates.id, templateId), eq(organizationTemplates.isActive, true)));
  if (!template || !canSeeOrganizationTemplate(actor, template)) throw new DomainError("not_found", NOT_FOUND);
  const parsed = templateSnapshotSchema.safeParse({
    teams: template.teamAssignments,
    groups: template.tableGroups,
    assignments: template.staffAssignments,
  });
  if (!parsed.success) throw new DomainError("conflict", "Şablon biçimi geçersiz; bu şablon uygulanamaz");
  return parsed.data;
}

/**
 * Şablonu etkinliğe uygular: ekipler, gruplar ve atamalar (tüm türler) şablondakiyle
 * değiştirilir — tek transaction; herhangi bir hata eski durumu aynen bırakır (spec §13.11).
 * Ekstra personele dokunulmaz.
 */
export async function applyOrganizationTemplate(
  db: Db | Tx,
  actor: Actor,
  input: ApplyTemplateInput,
): Promise<TemplateApplyReport> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const snapshot = await loadSnapshot(tx, actor, input.templateId);
    const eventId = input.eventId;

    const tables = await tx
      .select({ id: eventTables.id, label: eventTables.label })
      .from(eventTables)
      .where(eq(eventTables.eventId, eventId));
    const tableIds = new Set(tables.map((t) => t.id));
    const idByLabel = new Map(tables.map((t) => [t.label, t.id]));
    const missingTables = new Map<string, TableRef>();
    const resolveTables = (refs: TableRef[]): string[] =>
      unique(
        refs.flatMap((ref) => {
          const id = tableIds.has(ref.id) ? ref.id : idByLabel.get(ref.label);
          if (id) return [id];
          missingTables.set(ref.label, ref);
          return [];
        }),
      );

    const staffIds = unique([
      ...snapshot.teams.flatMap((t) => [t.leaderStaffId, ...t.members.map((m) => m.staffId)]),
      ...snapshot.groups.map((g) => g.supervisorStaffId),
      ...snapshot.assignments.map((a) => a.staffId),
    ]).filter((id): id is string => typeof id === "string");
    const uuidLike = staffIds.filter(isUuid);
    const activeRows =
      uuidLike.length > 0
        ? await tx
            .select({ id: staff.id })
            .from(staff)
            .where(and(inArray(staff.id, uuidLike), eq(staff.status, "active")))
        : [];
    const active = new Set(activeRows.map((r) => r.id));
    const missingStaff = new Set<string>();
    const activeOrNull = (id: string | null | undefined): string | null => {
      if (!id) return null;
      if (active.has(id)) return id;
      missingStaff.add(id);
      return null;
    };

    const shiftIds = unique(snapshot.assignments.flatMap((a) => (a.shiftId ? [a.shiftId] : []))).filter(isUuid);
    const usableShiftRows =
      shiftIds.length > 0
        ? await tx
            .select({ id: workShifts.id })
            .from(workShifts)
            .where(and(inArray(workShifts.id, shiftIds), or(isNull(workShifts.eventId), eq(workShifts.eventId, eventId))))
        : [];
    const usableShifts = new Set(usableShiftRows.map((r) => r.id));
    const points = await tx
      .select({ id: servicePoints.id, name: servicePoints.name })
      .from(servicePoints)
      .where(eq(servicePoints.eventId, eventId));
    const pointByName = new Map(points.map((p) => [p.name, p.id]));
    const pointRoles = await loadServicePointRoles(tx, eventId);
    const roleMismatches: string[] = [];
    const missingShifts = new Set<string>();
    const missingPoints = new Set<string>();

    const teamIdByKey = new Map(snapshot.teams.map((t) => [t.key, randomUUID()]));
    const teamsInput: TeamInput[] = snapshot.teams.map((t) => ({
      id: teamIdByKey.get(t.key),
      name: t.name,
      color: t.color,
      sortOrder: t.sortOrder,
      leaderStaffId: activeOrNull(t.leaderStaffId),
      members: t.members.flatMap((m) =>
        activeOrNull(m.staffId)
          ? [{ staffId: m.staffId, isLeader: m.isLeader, role: m.role, shiftStart: m.shiftStart, shiftEnd: m.shiftEnd }]
          : [],
      ),
    }));
    const groupsInput: GroupInput[] = snapshot.groups.map((g) => ({
      name: g.name,
      color: g.color,
      groupType: g.groupType,
      sortOrder: g.sortOrder,
      notes: g.notes,
      teamId: g.teamKey ? (teamIdByKey.get(g.teamKey) ?? null) : null,
      supervisorStaffId: activeOrNull(g.supervisorStaffId),
      tableIds: resolveTables(g.tables),
    }));
    const assignmentsInput: AssignmentInput[] = snapshot.assignments.flatMap((a) => {
      if (!activeOrNull(a.staffId)) return [];
      if (a.shiftId && !usableShifts.has(a.shiftId)) {
        missingShifts.add(a.shiftId);
        return [];
      }
      let servicePointId: string | null = null;
      if (a.assignmentType === "service_point") {
        servicePointId = a.servicePointName ? (pointByName.get(a.servicePointName) ?? null) : null;
        if (!servicePointId) {
          missingPoints.add(a.servicePointName ?? "?");
          return [];
        }
        if (!isRoleAllowed(pointRoles.get(servicePointId)?.roles ?? [], a.role)) {
          roleMismatches.push(`${a.staffId} @ ${a.servicePointName ?? "?"}`);
          return [];
        }
      }
      // Eski şablonlarda eksik/eşit özel saat olabilir: geçersizse vardiyanın saati kullanılır.
      const validTimes = overrideTimesError(a.shiftStart, a.shiftEnd) === null;
      return [
        {
          staffId: a.staffId,
          shiftId: a.shiftId ?? null,
          teamId: a.teamKey ? (teamIdByKey.get(a.teamKey) ?? null) : null,
          assignmentType: a.assignmentType,
          servicePointId,
          role: a.role,
          shiftStart: validTimes ? a.shiftStart : null,
          shiftEnd: validTimes ? a.shiftEnd : null,
          specialTaskLocation: a.specialTaskLocation,
          specialTaskStartTime: a.specialTaskStartTime,
          specialTaskEndTime: a.specialTaskEndTime,
          color: a.color,
          notes: a.notes,
          sortOrder: a.sortOrder,
          tableIds: a.assignmentType === "table" ? resolveTables(a.tables) : [],
        },
      ];
    });

    const savedTeams = await applyTeams(tx, eventId, teamsInput);
    const savedGroups = await applyGroups(tx, eventId, groupsInput);
    const savedAssignments = await applyAssignments(tx, eventId, assignmentsInput);

    return {
      teams: savedTeams.length,
      groups: savedGroups.length,
      assignments: savedAssignments.length,
      missingTables: [...missingTables.values()],
      missingStaffIds: [...missingStaff],
      missingShiftIds: [...missingShifts],
      missingServicePoints: [...missingPoints],
      roleMismatches,
    };
  });
}
