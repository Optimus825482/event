import { asc, eq } from "drizzle-orm";
import { expect } from "vitest";
import { db } from "@/db/client";
import {
  assignmentTables,
  eventStaffAssignments,
  tableGroupTables,
  tableGroups,
  teamMembers,
  teams,
} from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import * as f from "../../helpers/factories";

export async function makeActor(actor: Actor = managerActor("entertainment")): Promise<Actor> {
  return persistActor(db, actor);
}

/** Sahiplik/eski rol testleri: eski rolle aktör (bu görevde dokunulmaz). */
export async function makeLegacy(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

export async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found"): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  return err as DomainError;
}

/** Organizatör + etkinlik + `tableCount` masa (M1, M2, ...) + `staffCount` personel. */
export async function setupEvent(opts: { tableCount?: number; staffCount?: number; actor?: Actor } = {}) {
  const actor = await makeActor(opts.actor);
  const event = await f.createEvent(db, { organizerId: actor.id });
  const tables = [];
  for (let i = 1; i <= (opts.tableCount ?? 4); i += 1) {
    tables.push(await f.createTable(db, event.id, { label: `M${String(i).padStart(2, "0")}`, x: i * 10, y: 0 }));
  }
  const people = [];
  for (let i = 1; i <= (opts.staffCount ?? 3); i += 1) {
    people.push(await f.createStaff(db, { fullName: `Personel ${i}` }));
  }
  return { actor, event, tables, people };
}

/** Etkinliğin ekip/grup/atama durumunu karşılaştırılabilir biçimde okur. */
export async function snapshot(eventId: string) {
  const teamRows = await db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(asc(teams.name));
  const memberRows = await db
    .select({ teamId: teamMembers.teamId, staffId: teamMembers.staffId, isLeader: teamMembers.isLeader })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.eventId, eventId))
    .orderBy(asc(teamMembers.staffId));
  const groupRows = await db
    .select()
    .from(tableGroups)
    .where(eq(tableGroups.eventId, eventId))
    .orderBy(asc(tableGroups.name));
  const groupTables = await db
    .select({ groupId: tableGroupTables.tableGroupId, tableId: tableGroupTables.tableId })
    .from(tableGroupTables)
    .where(eq(tableGroupTables.eventId, eventId))
    .orderBy(asc(tableGroupTables.tableId));
  const assignmentRows = await db
    .select()
    .from(eventStaffAssignments)
    .where(eq(eventStaffAssignments.eventId, eventId))
    .orderBy(asc(eventStaffAssignments.id));
  const assignmentTableRows = await db
    .select({ assignmentId: assignmentTables.assignmentId, tableId: assignmentTables.tableId })
    .from(assignmentTables)
    .where(eq(assignmentTables.eventId, eventId))
    .orderBy(asc(assignmentTables.assignmentId), asc(assignmentTables.tableId));
  const strip = <T extends { updatedAt: Date }>(rows: T[]) => rows.map((r) => ({ ...r, updatedAt: null }));
  return {
    teams: strip(teamRows),
    members: memberRows,
    groups: strip(groupRows),
    groupTables,
    assignments: strip(assignmentRows),
    assignmentTables: assignmentTableRows,
  };
}

export async function tablesOfGroup(groupId: string): Promise<string[]> {
  const rows = await db
    .select({ tableId: tableGroupTables.tableId })
    .from(tableGroupTables)
    .where(eq(tableGroupTables.tableGroupId, groupId));
  return rows.map((r) => r.tableId).sort();
}

export async function tablesOfAssignment(assignmentId: string): Promise<string[]> {
  const rows = await db
    .select({ tableId: assignmentTables.tableId })
    .from(assignmentTables)
    .where(eq(assignmentTables.assignmentId, assignmentId));
  return rows.map((r) => r.tableId).sort();
}

export function sorted(ids: string[]): string[] {
  return [...ids].sort();
}
