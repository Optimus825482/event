import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { assignmentTables, eventStaffAssignments, eventTables, tableGroupTables, tableGroups, teams } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { DomainError } from "@/lib/action";
import { withEventWrite } from "./access";
import { STAFFING_MESSAGES } from "./db-errors";
import { diffLinks, splitKept, unique } from "./diff";
import type { AssignTeamToGroupInput, GroupInput, SaveTableGroupsInput } from "./schemas";
import { DEFAULT_COLOR } from "./teams-service";

export type SavedGroup = { id: string; name: string };

/** Verilen ekip kimliklerinin hepsi bu etkinliğin ekibi değilse `conflict`. */
export async function assertTeamsInEvent(tx: Tx, eventId: string, teamIds: Array<string | null | undefined>) {
  const ids = unique(teamIds.filter((id): id is string => typeof id === "string"));
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.eventId, eventId), inArray(teams.id, ids)));
  if (rows.length !== ids.length) throw new DomainError("conflict", STAFFING_MESSAGES.teamNotInEvent);
}

function groupValues(eventId: string, group: GroupInput, index: number) {
  return {
    eventId,
    name: group.name,
    color: group.color ?? DEFAULT_COLOR,
    teamId: group.teamId ?? null,
    supervisorStaffId: group.supervisorStaffId ?? null,
    groupType: group.groupType ?? "standard",
    sortOrder: group.sortOrder ?? index,
    notes: group.notes ?? null,
  };
}

/** Loca grubu yalnızca loca masalarını, standart grup yalnızca loca olmayanları içerir (istek başına, hiçbir şey yazılmadan). */
async function assertGroupTypesMatchTables(tx: Tx, eventId: string, input: GroupInput[]) {
  const ids = unique(input.flatMap((g) => g.tableIds));
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: eventTables.id, label: eventTables.label, isLoca: eventTables.isLoca })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const notLoca = new Set<string>();
  const loca = new Set<string>();
  for (const group of input) {
    for (const tableId of group.tableIds) {
      const table = byId.get(tableId);
      if (!table) continue;
      if (group.groupType === "loca" && !table.isLoca) notLoca.add(table.label);
      if (group.groupType !== "loca" && table.isLoca) loca.add(table.label);
    }
  }
  if (notLoca.size > 0) {
    throw new DomainError("conflict", `Loca grubuna yalnızca loca masaları eklenebilir: ${[...notLoca].sort().join(", ")}`);
  }
  if (loca.size > 0) {
    throw new DomainError("conflict", `Loca masaları yalnızca loca grubuna eklenebilir: ${[...loca].sort().join(", ")}`);
  }
}

/**
 * Etkinliğin masa gruplarını istenen duruma getirir (transaction içinde çağrılır).
 * Bir masa yalnızca tek gruba ait olabilir (spec §13.10): istek içinde ikinci kez görülen
 * masa reddedilir; veritabanı tekillik kısıtı ikinci savunmadır. Masanın gruptan gruba
 * taşınması aynı transaction'da önce eski bağın silinip yenisinin eklenmesidir.
 */
export async function applyGroups(tx: Tx, eventId: string, input: GroupInput[]): Promise<SavedGroup[]> {
  const seenTables = new Set<string>();
  for (const group of input) {
    for (const tableId of group.tableIds) {
      if (seenTables.has(tableId)) throw new DomainError("conflict", STAFFING_MESSAGES.tableInTwoGroups);
      seenTables.add(tableId);
    }
  }
  await assertTeamsInEvent(
    tx,
    eventId,
    input.map((g) => g.teamId),
  );
  await assertGroupTypesMatchTables(tx, eventId, input);

  const existing = await tx.select({ id: tableGroups.id }).from(tableGroups).where(eq(tableGroups.eventId, eventId));
  const { keep, deleteIds } = splitKept(input, existing);
  if (deleteIds.length > 0) await tx.delete(tableGroups).where(inArray(tableGroups.id, deleteIds));

  const saved: SavedGroup[] = [];
  const desired = new Map<string, string[]>();
  for (const [index, group] of input.entries()) {
    let id: string;
    if (group.id && keep.has(group.id)) {
      await tx
        .update(tableGroups)
        .set({ ...groupValues(eventId, group, index), updatedAt: new Date() })
        .where(eq(tableGroups.id, group.id));
      id = group.id;
    } else {
      const [row] = await tx
        .insert(tableGroups)
        .values({ ...(group.id ? { id: group.id } : {}), ...groupValues(eventId, group, index) })
        .returning({ id: tableGroups.id });
      if (!row) throw new Error("masa grubu eklenemedi");
      id = row.id;
    }
    desired.set(id, group.tableIds);
    saved.push({ id, name: group.name });
  }

  const links = await tx
    .select({ id: tableGroupTables.id, owner: tableGroupTables.tableGroupId, value: tableGroupTables.tableId })
    .from(tableGroupTables)
    .where(eq(tableGroupTables.eventId, eventId));
  const { deleteIds: linkDeletes, inserts } = diffLinks(links, desired);
  if (linkDeletes.length > 0) await tx.delete(tableGroupTables).where(inArray(tableGroupTables.id, linkDeletes));
  if (inserts.length > 0) {
    await tx
      .insert(tableGroupTables)
      .values(inserts.map((l) => ({ eventId, tableGroupId: l.owner, tableId: l.value })));
  }
  await publish(tx, { type: "table.updated", eventId });
  return saved;
}

/**
 * §13.10: bir grubun ekibi, masalarındaki ekipli atamaların ekibiyle çelişemez. Yalnızca grup
 * tek başına kaydedilirken denetlenir; bütün organizasyon ya da şablon yazılırken atamalar
 * grup yazıldıktan sonra kendi denetimlerinden geçer.
 */
async function assertGroupTeamsMatchAssignments(tx: Tx, eventId: string) {
  const [clash] = await tx
    .select({ id: eventStaffAssignments.id })
    .from(eventStaffAssignments)
    .innerJoin(assignmentTables, eq(assignmentTables.assignmentId, eventStaffAssignments.id))
    .innerJoin(tableGroupTables, eq(tableGroupTables.tableId, assignmentTables.tableId))
    .innerJoin(tableGroups, eq(tableGroups.id, tableGroupTables.tableGroupId))
    .where(
      and(
        eq(eventStaffAssignments.eventId, eventId),
        isNotNull(eventStaffAssignments.teamId),
        isNotNull(tableGroups.teamId),
        ne(eventStaffAssignments.teamId, tableGroups.teamId),
      ),
    )
    .limit(1);
  if (clash) throw new DomainError("conflict", STAFFING_MESSAGES.teamTableMismatch);
}

export async function saveTableGroups(
  db: Db | Tx,
  actor: Actor,
  input: SaveTableGroupsInput,
): Promise<{ groups: SavedGroup[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const groups = await applyGroups(tx, input.eventId, input.groups);
    await assertGroupTeamsMatchAssignments(tx, input.eventId);
    return { groups };
  });
}

/**
 * Grubu ekibe bağlar (ya da bağı kaldırır). Eski davranış korunur: grup ekibin rengini alır
 * ve gruptaki masalara atanmış personelin atamalarına ekip yazılır — hepsi tek transaction.
 */
export async function assignTeamToGroup(
  db: Db | Tx,
  actor: Actor,
  input: AssignTeamToGroupInput,
): Promise<{ groupId: string; teamId: string | null }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const [group] = await tx
      .select({ id: tableGroups.id })
      .from(tableGroups)
      .where(and(eq(tableGroups.id, input.groupId), eq(tableGroups.eventId, input.eventId)));
    if (!group) throw new DomainError("not_found", "Masa grubu bulunamadı");

    const teamId = input.teamId ?? null;
    if (teamId === null) {
      await tx.update(tableGroups).set({ teamId: null, updatedAt: new Date() }).where(eq(tableGroups.id, group.id));
      await publish(tx, { type: "table.updated", eventId: input.eventId });
      return { groupId: group.id, teamId };
    }

    const [team] = await tx
      .select({ id: teams.id, color: teams.color })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, input.eventId)));
    if (!team) throw new DomainError("conflict", STAFFING_MESSAGES.teamNotInEvent);

    await tx
      .update(tableGroups)
      .set({ teamId, color: team.color, updatedAt: new Date() })
      .where(eq(tableGroups.id, group.id));

    const groupTables = tx
      .select({ tableId: tableGroupTables.tableId })
      .from(tableGroupTables)
      .where(eq(tableGroupTables.tableGroupId, group.id));
    const affected = tx
      .select({ id: assignmentTables.assignmentId })
      .from(assignmentTables)
      .where(and(eq(assignmentTables.eventId, input.eventId), inArray(assignmentTables.tableId, groupTables)));
    await tx
      .update(eventStaffAssignments)
      .set({ teamId, updatedAt: new Date() })
      .where(and(eq(eventStaffAssignments.eventId, input.eventId), inArray(eventStaffAssignments.id, affected)));
    await publish(tx, { type: "table.updated", eventId: input.eventId });
    return { groupId: group.id, teamId };
  });
}
