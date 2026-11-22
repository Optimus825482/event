import * as schema from "@/db/schema";
import { timestamps } from "./catalogs";
import { type Ctx, isRecord } from "./context";
import { asUuid, byCreatedThenId, type Row, stableId, toTime } from "./values";

/**
 * Ekipler ve masa grupları.
 * - Eski `teams` (genel, etkinliksiz) → `teams` (event_id NULL); `memberIds` → `team_members`.
 * - Eski `service_teams` (etkinliğe bağlı) → `teams`; `members[]` → `team_members`,
 *   `leaders[]` → `team_members.is_leader/role/shift_*`; `tableIds` → ekibe bağlı masa grubu.
 * - Eski `table_groups.tableIds` → `table_group_tables`; bir masa yalnızca bir gruba ait olabilir
 *   (ilk grup — sortOrder, createdAt sırası — kazanır, diğerleri raporlanır).
 */

type MemberRow = typeof schema.teamMembers.$inferInsert & { teamId: string; staffId: string };

export async function migrateTeams(ctx: Ctx): Promise<Map<string, string>> {
  const L = ctx.legacy;
  const teamRows: (typeof schema.teams.$inferInsert & { id: string })[] = [];
  const members = new Map<string, MemberRow>();
  /** Eski ekip kimliği (teams ya da service_teams) → yeni teams.id. */
  const teamIdMap = new Map<string, string>();

  const staffOf = (ref: string | null, table: string, id: string, field: string): string | null => {
    if (ref === null || ref.trim() === "") return null;
    const staffId = ctx.resolveStaff(ref);
    if (staffId === null) ctx.add("unresolvedStaffReferences", { table, id, field, ref });
    return staffId;
  };
  const addMember = (teamId: string, staffId: string, patch: Partial<MemberRow> = {}, base?: Row) => {
    const key = `${teamId}:${staffId}`;
    const prev = members.get(key);
    if (prev) Object.assign(prev, patch);
    else members.set(key, { teamId, staffId, ...(base ? timestamps(base) : {}), ...patch });
  };

  for (const r of L.teams) {
    teamIdMap.set(r.id, r.id);
    teamRows.push({
      id: r.id,
      eventId: null,
      name: r.text("name"),
      color: r.text("color", "#3b82f6"),
      leaderStaffId: staffOf(r.str("leaderId"), "teams", r.id, "leaderId"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    });
    for (const m of r.strings("memberIds")) {
      const staffId = staffOf(m, "teams", r.id, "memberIds");
      if (staffId) addMember(r.id, staffId, {}, r);
    }
  }

  for (const r of L.service_teams) {
    let id = r.id;
    if (teamIdMap.has(id)) {
      id = stableId("service-team", r.id);
      ctx.add("information", { table: "service_teams", id: r.id, detail: `kimlik teams ile çakışıyor; yeni kimlik ${id}` });
    }
    teamIdMap.set(r.id, id);
    const rawEvent = r.str("eventId");
    const eventId = ctx.resolveEvent(rawEvent);
    if (rawEvent !== null && eventId === null) ctx.add("orphanReferences", { table: "service_teams", id: r.id, field: "eventId", ref: rawEvent, action: "genel ekip (NULL)" });
    teamRows.push({
      id,
      eventId,
      name: r.text("name"),
      color: r.text("color", "#3b82f6"),
      leaderStaffId: staffOf(r.str("leaderId"), "service_teams", r.id, "leaderId"),
      ...timestamps(r),
    });
    ctx.teamIds.add(id);
    const list = r.json("members");
    for (const m of Array.isArray(list) ? list : []) {
      const ref = isRecord(m) && typeof m.id === "string" ? m.id : null;
      const staffId = staffOf(ref, "service_teams", r.id, "members");
      if (staffId) addMember(id, staffId, {}, r);
    }
    const leaders = r.json("leaders");
    for (const l of Array.isArray(leaders) ? leaders : []) {
      if (!isRecord(l)) continue;
      const staffId = staffOf(typeof l.staffId === "string" ? l.staffId : null, "service_teams", r.id, "leaders");
      if (!staffId) continue;
      const start = toTime(typeof l.shiftStart === "string" ? l.shiftStart : null);
      const end = toTime(typeof l.shiftEnd === "string" ? l.shiftEnd : null);
      if (!start.ok || !end.ok) ctx.add("invalidValues", { table: "service_teams", id: r.id, field: "leaders.shift", to: null });
      addMember(id, staffId, { isLeader: true, role: typeof l.role === "string" ? l.role : null, shiftStart: start.value, shiftEnd: end.value }, r);
    }
  }
  for (const t of teamRows) ctx.teamIds.add(t.id);
  await ctx.w.insert(schema.teams, teamRows);
  await ctx.w.insert(schema.teamMembers, [...members.values()]);
  await migrateTableGroups(ctx, teamIdMap);
  return teamIdMap;
}

async function migrateTableGroups(ctx: Ctx, teamIdMap: Map<string, string>): Promise<void> {
  const L = ctx.legacy;
  const groups: (typeof schema.tableGroups.$inferInsert & { id: string; eventId: string })[] = [];
  const links: (typeof schema.tableGroupTables.$inferInsert)[] = [];
  /** `${eventId}:${tableId}` → grup kimliği ve grubun ekibi. */
  const owner = new Map<string, { groupId: string; teamId: string | null }>();

  const link = (eventId: string, groupId: string, teamId: string | null, ref: string, source: string, sourceId: string) => {
    const tableId = ctx.resolveTable(eventId, ref);
    if (tableId === null) {
      ctx.add("orphanTableReferences", { table: source, id: sourceId, eventId, legacyRef: ref, action: "bağlantı taşınmadı" });
      return;
    }
    const key = `${eventId}:${tableId}`;
    const prev = owner.get(key);
    if (prev) {
      if (prev.groupId !== groupId && !(teamId !== null && prev.teamId === teamId)) {
        ctx.add("tableGroupConflicts", { eventId, tableId, legacyRef: ref, keptGroupId: prev.groupId, droppedFrom: `${source}:${sourceId}` });
      }
      return;
    }
    owner.set(key, { groupId, teamId });
    links.push({ eventId, tableGroupId: groupId, tableId });
  };

  const sorted = [...L.table_groups].sort((a, b) => (a.int("sortOrder") ?? 0) - (b.int("sortOrder") ?? 0) || byCreatedThenId(a, b));
  for (const r of sorted) {
    const eventId = r.text("eventId");
    const rawTeam = r.trimmed("assignedTeamId");
    const teamId = rawTeam ? (teamIdMap.get(asUuid(rawTeam) ?? rawTeam) ?? null) : null;
    if (rawTeam && teamId === null) ctx.add("orphanReferences", { table: "table_groups", id: r.id, field: "assignedTeamId", ref: rawTeam, action: "NULL" });
    const rawSupervisor = r.trimmed("assignedSupervisorId");
    const supervisorStaffId = rawSupervisor ? ctx.resolveStaff(rawSupervisor) : null;
    if (rawSupervisor && supervisorStaffId === null) {
      ctx.add("unresolvedStaffReferences", { table: "table_groups", id: r.id, field: "assignedSupervisorId", ref: rawSupervisor });
    }
    groups.push({
      id: r.id,
      eventId,
      name: r.text("name"),
      color: r.text("color", "#3b82f6"),
      teamId,
      supervisorStaffId,
      groupType: r.text("groupType", "standard"),
      sortOrder: r.int("sortOrder") ?? 0,
      notes: r.str("notes"),
      ...timestamps(r),
    });
    ctx.tableGroups.set(r.id, eventId);
    for (const ref of r.strings("tableIds")) link(eventId, r.id, teamId, ref, "table_groups", r.id);
  }

  // service_teams.tableIds: gruba girmemiş masalar için ekibe bağlı yeni grup.
  for (const r of L.service_teams) {
    const eventId = ctx.resolveEvent(r.str("eventId"));
    const refs = r.strings("tableIds");
    if (refs.length === 0) continue;
    const teamId = teamIdMap.get(r.id) ?? null;
    if (eventId === null || teamId === null) {
      ctx.add("skippedRows", { table: "service_teams", id: r.id, field: "tableIds", reason: "etkinlik yok; masa bağlantıları taşınmadı" });
      continue;
    }
    const groupId = stableId("team-table-group", r.id);
    const before = links.length;
    for (const ref of refs) link(eventId, groupId, teamId, ref, "service_teams", r.id);
    if (links.length > before) {
      groups.push({ id: groupId, eventId, name: r.text("name"), color: r.text("color", "#3b82f6"), teamId, ...timestamps(r) });
      ctx.tableGroups.set(groupId, eventId);
      ctx.add("information", { table: "service_teams", id: r.id, detail: `tableIds için masa grubu oluşturuldu: ${groupId}` });
    }
  }
  await ctx.w.insert(schema.tableGroups, groups);
  await ctx.w.insert(schema.tableGroupTables, links);
}
