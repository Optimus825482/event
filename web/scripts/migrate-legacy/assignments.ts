import * as schema from "@/db/schema";
import { timestamps } from "./catalogs";
import { type Ctx, jsonStrings } from "./context";
import { asUuid, byCreatedThenId, type Row, toTime } from "./values";

/**
 * Personel atamaları üç eski kaynaktan tek tabloya (`event_staff_assignments`) birleşir:
 * 1. `event_staff_assignments` (personel tabanlı; tableIds → assignment_tables),
 * 2. `service_point_staff_assignments` (assignment_type = 'service_point'),
 * 3. `staff_assignments` (kullanıcı tabanlı, en eski biçim; kullanıcı → personel eşlemesiyle).
 * Yeni tekil kısıt (event_id, staff_id, shift_id) NULLS NOT DISTINCT: aynı anahtar ikinci kez
 * gelirse ikisi de masa ataması ise masalar ilkine eklenir (birleştirme), değilse sonraki atlanır.
 * Ardından ekstra personel ve organizasyon şablonları.
 */

type AssignmentRow = typeof schema.eventStaffAssignments.$inferInsert & { id: string; eventId: string; staffId: string };
type AssignmentType = (typeof schema.assignmentType.enumValues)[number];

function time(ctx: Ctx, r: Row, table: string, field: string): string | null {
  const t = toTime(r.str(field));
  if (!t.ok) ctx.add("invalidValues", { table, id: r.id, field, from: r.str(field), to: null });
  return t.value;
}

export async function migrateAssignments(ctx: Ctx, teamIdMap: Map<string, string>): Promise<void> {
  const L = ctx.legacy;
  const byKey = new Map<string, AssignmentRow>();
  const rows: AssignmentRow[] = [];
  const tables = new Map<string, Set<string>>();

  const accept = (row: AssignmentRow, tableRefs: string[], source: string) => {
    const key = `${row.eventId}:${row.staffId}:${row.shiftId ?? ""}`;
    const prev = byKey.get(key);
    const target = prev && prev.assignmentType === "table" && row.assignmentType === "table" ? prev : prev ? null : row;
    if (prev && target === null) {
      ctx.add("assignmentConflicts", { source, id: row.id, keptAssignmentId: prev.id, eventId: row.eventId, staffId: row.staffId, action: "atlandı" });
      return;
    }
    if (prev && target === prev) ctx.add("assignmentConflicts", { source, id: row.id, keptAssignmentId: prev.id, eventId: row.eventId, staffId: row.staffId, action: "masalar birleştirildi" });
    if (!prev) {
      byKey.set(key, row);
      rows.push(row);
    }
    const owner = target ?? row;
    const set = tables.get(owner.id) ?? new Set<string>();
    tables.set(owner.id, set);
    for (const ref of tableRefs) {
      const tableId = ctx.resolveTable(row.eventId, ref);
      if (tableId === null) ctx.add("orphanTableReferences", { table: source, id: row.id, eventId: row.eventId, legacyRef: ref, action: "bağlantı taşınmadı" });
      else set.add(tableId);
    }
  };
  const shiftOf = (r: Row, table: string): string | null => {
    const raw = asUuid(r.str("shiftId"));
    if (raw !== null && !ctx.shiftIds.has(raw)) {
      ctx.add("orphanReferences", { table, id: r.id, field: "shiftId", ref: raw, action: "NULL" });
      return null;
    }
    return raw;
  };

  for (const r of [...L.event_staff_assignments].sort(byCreatedThenId)) {
    const rawType = r.text("assignmentType", "table");
    const type: AssignmentType = rawType === "special_task" ? "special_task" : "table";
    if (rawType !== "table" && rawType !== "special_task") ctx.add("invalidValues", { table: "event_staff_assignments", id: r.id, field: "assignmentType", from: rawType, to: "table" });
    const rawTeam = asUuid(r.str("teamId"));
    accept(
      {
        id: r.id,
        eventId: r.text("eventId"),
        staffId: r.text("staffId"),
        shiftId: shiftOf(r, "event_staff_assignments"),
        teamId: rawTeam ? (teamIdMap.get(rawTeam) ?? null) : null,
        assignmentType: type,
        shiftStart: time(ctx, r, "event_staff_assignments", "shiftStart"),
        shiftEnd: time(ctx, r, "event_staff_assignments", "shiftEnd"),
        specialTaskLocation: r.str("specialTaskLocation"),
        specialTaskStartTime: time(ctx, r, "event_staff_assignments", "specialTaskStartTime"),
        specialTaskEndTime: time(ctx, r, "event_staff_assignments", "specialTaskEndTime"),
        color: r.str("color"),
        notes: r.str("notes"),
        sortOrder: r.int("sortOrder") ?? 0,
        isActive: r.bool("isActive", true),
        ...timestamps(r),
      },
      r.strings("tableIds"),
      "event_staff_assignments",
    );
  }

  for (const r of [...L.service_point_staff_assignments].sort(byCreatedThenId)) {
    const staffId = ctx.resolveStaff(r.str("staffId"));
    if (staffId === null) {
      ctx.add("unresolvedStaffReferences", { table: "service_point_staff_assignments", id: r.id, field: "staffId", ref: r.str("staffId"), action: "satır atlandı" });
      continue;
    }
    accept(
      {
        id: r.id,
        eventId: r.text("eventId"),
        staffId,
        shiftId: shiftOf(r, "service_point_staff_assignments"),
        assignmentType: "service_point",
        servicePointId: r.text("servicePointId"),
        role: r.str("role"),
        shiftStart: time(ctx, r, "service_point_staff_assignments", "shiftStart"),
        shiftEnd: time(ctx, r, "service_point_staff_assignments", "shiftEnd"),
        notes: r.str("notes"),
        sortOrder: r.int("sortOrder") ?? 0,
        isActive: r.bool("isActive", true),
        ...timestamps(r),
      },
      [],
      "service_point_staff_assignments",
    );
  }

  for (const r of [...L.staff_assignments].sort(byCreatedThenId)) {
    const staffId = ctx.resolveStaff(r.str("staffId"));
    if (staffId === null) {
      ctx.add("unresolvedStaffReferences", { table: "staff_assignments", id: r.id, field: "staffId", ref: r.str("staffId"), action: "satır atlandı" });
      continue;
    }
    accept(
      { id: r.id, eventId: r.text("eventId"), staffId, assignmentType: "table", color: r.str("color"), ...timestamps(r) },
      r.strings("assignedTableIds"),
      "staff_assignments",
    );
  }

  await ctx.w.insert(schema.eventStaffAssignments, rows);
  const eventOf = new Map(rows.map((r) => [r.id, r.eventId]));
  await ctx.w.insert(
    schema.assignmentTables,
    [...tables.entries()].flatMap(([assignmentId, set]) =>
      [...set].map((tableId) => ({ eventId: eventOf.get(assignmentId) ?? "", assignmentId, tableId })),
    ),
  );
  await migrateExtraStaff(ctx);
  await migrateOrganizationTemplates(ctx);
}

async function migrateExtraStaff(ctx: Ctx): Promise<void> {
  const tableLinks: (typeof schema.eventExtraStaffTables.$inferInsert)[] = [];
  const groupLinks: (typeof schema.eventExtraStaffGroups.$inferInsert)[] = [];
  const rows = ctx.legacy.event_extra_staff.map((r) => {
    const eventId = r.text("event_id");
    for (const ref of new Set(jsonStrings(r.json("assigned_tables")))) {
      const tableId = ctx.resolveTable(eventId, ref);
      if (tableId === null) ctx.add("orphanTableReferences", { table: "event_extra_staff", id: r.id, eventId, legacyRef: ref, action: "bağlantı taşınmadı" });
      else if (!tableLinks.some((l) => l.extraStaffId === r.id && l.tableId === tableId)) tableLinks.push({ eventId, extraStaffId: r.id, tableId });
    }
    for (const ref of new Set(jsonStrings(r.json("assigned_groups")))) {
      const groupId = asUuid(ref);
      if (groupId === null || ctx.tableGroups.get(groupId) !== eventId) {
        ctx.add("orphanReferences", { table: "event_extra_staff", id: r.id, field: "assigned_groups", ref, action: "bağlantı taşınmadı" });
      } else groupLinks.push({ eventId, extraStaffId: r.id, tableGroupId: groupId });
    }
    return {
      id: r.id,
      eventId,
      fullName: r.text("full_name"),
      position: r.str("position"),
      role: r.str("role"),
      shiftStart: time(ctx, r, "event_extra_staff", "shift_start"),
      shiftEnd: time(ctx, r, "event_extra_staff", "shift_end"),
      color: r.str("color"),
      notes: r.str("notes"),
      sortOrder: r.int("sort_order") ?? 0,
      isActive: r.bool("is_active", true),
      ...timestamps(r),
    };
  });
  await ctx.w.insert(schema.eventExtraStaff, rows);
  await ctx.w.insert(schema.eventExtraStaffTables, tableLinks);
  await ctx.w.insert(schema.eventExtraStaffGroups, groupLinks);
}

async function migrateOrganizationTemplates(ctx: Ctx): Promise<void> {
  await ctx.w.insert(
    schema.organizationTemplates,
    ctx.legacy.organization_templates.map((r) => ({
      id: r.id,
      name: r.text("name"),
      description: r.str("description"),
      createdById: ctx.resolveUser(r.str("createdById")),
      staffAssignments: r.json("staffAssignments") ?? [],
      teamAssignments: r.json("teamAssignments") ?? [],
      tableGroups: r.json("tableGroups") ?? [],
      settings: r.json("settings") ?? {},
      tags: r.strings("tags"),
      isDefault: r.bool("isDefault", false),
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
}
