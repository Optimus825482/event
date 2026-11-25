import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventStaffAssignments,
  eventTables,
  staff,
  tableGroupTables,
  tableGroups,
} from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { getReadableEvent, withEventWrite } from "./access";
import type { GroupUngroupedLocasInput } from "./schemas";

export type LocaStaffingRow = {
  tableId: string;
  label: string;
  floor: number;
  groupId: string | null;
  groupName: string | null;
  supervisorStaffId: string | null;
  staff: { staffId: string; fullName: string; role: string | null }[];
};

/** Etkinliğin loca masaları (sıra numarası, sonra etiket) ve her birinin grubu, süpervizörü, personeli. */
export async function listLocaStaffing(ex: Db | Tx, actor: Actor, eventId: string): Promise<LocaStaffingRow[]> {
  await getReadableEvent(ex, actor, eventId);

  const tables = await ex
    .select({
      tableId: eventTables.id,
      label: eventTables.label,
      floor: eventTables.floor,
      sortNumber: eventTables.sortNumber,
      groupId: tableGroups.id,
      groupName: tableGroups.name,
      supervisorStaffId: tableGroups.supervisorStaffId,
    })
    .from(eventTables)
    .leftJoin(
      tableGroupTables,
      and(eq(tableGroupTables.eventId, eventTables.eventId), eq(tableGroupTables.tableId, eventTables.id)),
    )
    .leftJoin(tableGroups, eq(tableGroups.id, tableGroupTables.tableGroupId))
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.isLoca, true)));
  if (tables.length === 0) return [];

  const people = await ex
    .select({
      tableId: assignmentTables.tableId,
      staffId: staff.id,
      fullName: staff.fullName,
      role: eventStaffAssignments.role,
    })
    .from(assignmentTables)
    .innerJoin(eventStaffAssignments, eq(eventStaffAssignments.id, assignmentTables.assignmentId))
    .innerJoin(staff, eq(staff.id, eventStaffAssignments.staffId))
    .where(
      and(
        eq(assignmentTables.eventId, eventId),
        inArray(
          assignmentTables.tableId,
          tables.map((t) => t.tableId),
        ),
      ),
    )
    .orderBy(asc(staff.fullName));
  const byTable = new Map<string, LocaStaffingRow["staff"]>();
  for (const p of people) {
    const list = byTable.get(p.tableId) ?? [];
    if (!list.some((x) => x.staffId === p.staffId)) list.push({ staffId: p.staffId, fullName: p.fullName, role: p.role });
    byTable.set(p.tableId, list);
  }

  return tables
    .sort((a, b) => {
      const an = a.sortNumber ?? Number.MAX_SAFE_INTEGER;
      const bn = b.sortNumber ?? Number.MAX_SAFE_INTEGER;
      return an - bn || a.label.localeCompare(b.label, "tr", { numeric: true });
    })
    .map((t) => ({
      tableId: t.tableId,
      label: t.label,
      floor: t.floor,
      groupId: t.groupId,
      groupName: t.groupName,
      supervisorStaffId: t.supervisorStaffId,
      staff: byTable.get(t.tableId) ?? [],
    }));
}

/** Grupsuz her loca masası için `Loca <etiket>` adlı tek masalı loca grubu açar (ad çakışırsa ` (2)`, ` (3)`...). */
export async function groupUngroupedLocas(
  db: Db,
  actor: Actor,
  input: GroupUngroupedLocasInput,
): Promise<{ created: number }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const ungrouped = await tx
      .select({ id: eventTables.id, label: eventTables.label, sortNumber: eventTables.sortNumber })
      .from(eventTables)
      .leftJoin(
        tableGroupTables,
        and(eq(tableGroupTables.eventId, eventTables.eventId), eq(tableGroupTables.tableId, eventTables.id)),
      )
      .where(and(eq(eventTables.eventId, input.eventId), eq(eventTables.isLoca, true), isNull(tableGroupTables.id)))
      .orderBy(asc(eventTables.sortNumber), asc(eventTables.label));
    if (ungrouped.length === 0) return { created: 0 };

    const existing = await tx
      .select({ name: tableGroups.name, sortOrder: tableGroups.sortOrder })
      .from(tableGroups)
      .where(eq(tableGroups.eventId, input.eventId));
    const taken = new Set(existing.map((g) => g.name));
    let nextOrder = existing.reduce((max, g) => Math.max(max, g.sortOrder), -1) + 1;

    for (const table of ungrouped) {
      const base = `Loca ${table.label}`;
      let name = base;
      for (let n = 2; taken.has(name); n += 1) name = `${base} (${n})`;
      taken.add(name);
      const [group] = await tx
        .insert(tableGroups)
        .values({ eventId: input.eventId, name, groupType: "loca", sortOrder: nextOrder })
        .returning({ id: tableGroups.id });
      if (!group) throw new Error("loca grubu eklenemedi");
      nextOrder += 1;
      await tx.insert(tableGroupTables).values({ eventId: input.eventId, tableGroupId: group.id, tableId: table.id });
    }
    await publish(tx, { type: "table.updated", eventId: input.eventId });
    return { created: ungrouped.length };
  });
}
