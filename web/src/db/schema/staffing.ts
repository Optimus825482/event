import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdOnly, pk, timestamps } from "./columns";
import { eventTables, events, servicePoints, workShifts } from "./events";
import { staff } from "./people";

// Ekipler, masa grupları ve personel atamaları. Eski sistemdeki dizi/JSON
// referansları (memberIds, tableIds, members, leaders) bağlantı tablolarına dönüştü.
// Etkinliğe ait bağlantı satırları bileşik (event_id, …) yabancı anahtar taşır:
// başka etkinliğin masası/grubu/ataması referans alınamaz.

export const teams = pgTable(
  "teams",
  {
    id: pk(),
    // NULL: etkinlikten bağımsız (genel) ekip; eski `teams` tablosu böyleydi.
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    leaderStaffId: uuid("leader_staff_id").references(() => staff.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("teams_event_id_idx").on(t.eventId), index("teams_leader_staff_id_idx").on(t.leaderStaffId)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: pk(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    // Eski service_teams.leaders[] girdileri: ekip içi lider/kaptan, görev ve saatleri.
    isLeader: boolean("is_leader").notNull().default(false),
    role: text("role"),
    shiftStart: time("shift_start"),
    shiftEnd: time("shift_end"),
    ...timestamps(),
  },
  (t) => [unique("team_members_team_staff_uq").on(t.teamId, t.staffId), index("team_members_staff_id_idx").on(t.staffId)],
);

export const tableGroups = pgTable(
  "table_groups",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    supervisorStaffId: uuid("supervisor_staff_id").references(() => staff.id, { onDelete: "set null" }),
    groupType: text("group_type").notNull().default("standard"),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    unique("table_groups_event_id_id_uq").on(t.eventId, t.id),
    index("table_groups_event_sort_idx").on(t.eventId, t.sortOrder),
    index("table_groups_team_id_idx").on(t.teamId),
    index("table_groups_supervisor_staff_id_idx").on(t.supervisorStaffId),
    check("table_groups_group_type_valid", sql`${t.groupType} IN ('standard','loca')`),
  ],
);

export const tableGroupTables = pgTable(
  "table_group_tables",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    tableGroupId: uuid("table_group_id").notNull(),
    tableId: uuid("table_id").notNull(),
    ...createdOnly(),
  },
  (t) => [
    foreignKey({
      name: "table_group_tables_group_fk",
      columns: [t.eventId, t.tableGroupId],
      foreignColumns: [tableGroups.eventId, tableGroups.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "table_group_tables_table_fk",
      columns: [t.eventId, t.tableId],
      foreignColumns: [eventTables.eventId, eventTables.id],
    }).onDelete("cascade"),
    // Bir masa etkinlik içinde yalnızca tek gruba ait olabilir.
    unique("table_group_tables_event_table_uq").on(t.eventId, t.tableId),
    index("table_group_tables_group_idx").on(t.eventId, t.tableGroupId),
  ],
);

export const assignmentType = pgEnum("assignment_type", ["table", "special_task", "service_point"]);

export const eventStaffAssignments = pgTable(
  "event_staff_assignments",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id").references(() => workShifts.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    assignmentType: assignmentType("assignment_type").notNull().default("table"),
    // (event_id, service_point_id) → service_points(event_id, id) bileşik yabancı anahtarı aşağıda.
    servicePointId: uuid("service_point_id"),
    role: text("role"),
    // Kişiye özel çalışma saati ("Özel saat"); ikisi de NULL ise vardiyanın saatleri geçerlidir.
    // Gece yarısını geçen vardiya (18:00–02:00) olağan olduğundan başlangıç < bitiş aranmaz.
    shiftStart: time("shift_start"),
    shiftEnd: time("shift_end"),
    specialTaskLocation: text("special_task_location"),
    specialTaskStartTime: time("special_task_start_time"),
    specialTaskEndTime: time("special_task_end_time"),
    color: text("color"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "event_staff_assignments_service_point_fk",
      columns: [t.eventId, t.servicePointId],
      foreignColumns: [servicePoints.eventId, servicePoints.id],
    }).onDelete("cascade"),
    // Aynı personel aynı etkinlik + vardiyaya bir kez atanır; vardiyasız (NULL) atama da tektir.
    unique("event_staff_assignments_event_staff_shift_uq").on(t.eventId, t.staffId, t.shiftId).nullsNotDistinct(),
    unique("event_staff_assignments_event_id_id_uq").on(t.eventId, t.id),
    check(
      "event_staff_assignments_service_point_matches_type",
      sql`(${t.assignmentType} = 'service_point') = (${t.servicePointId} IS NOT NULL)`,
    ),
    check("event_staff_assignments_shift_times_paired", sql`(${t.shiftStart} IS NULL) = (${t.shiftEnd} IS NULL)`),
    check(
      "event_staff_assignments_shift_times_distinct",
      sql`${t.shiftStart} IS NULL OR ${t.shiftStart} <> ${t.shiftEnd}`,
    ),
    index("event_staff_assignments_staff_id_idx").on(t.staffId),
    index("event_staff_assignments_shift_id_idx").on(t.shiftId),
    index("event_staff_assignments_team_id_idx").on(t.teamId),
    index("event_staff_assignments_service_point_idx").on(t.eventId, t.servicePointId),
  ],
);

export const assignmentTables = pgTable(
  "assignment_tables",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    assignmentId: uuid("assignment_id").notNull(),
    tableId: uuid("table_id").notNull(),
    ...createdOnly(),
  },
  (t) => [
    foreignKey({
      name: "assignment_tables_assignment_fk",
      columns: [t.eventId, t.assignmentId],
      foreignColumns: [eventStaffAssignments.eventId, eventStaffAssignments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assignment_tables_table_fk",
      columns: [t.eventId, t.tableId],
      foreignColumns: [eventTables.eventId, eventTables.id],
    }).onDelete("cascade"),
    unique("assignment_tables_assignment_table_uq").on(t.assignmentId, t.tableId),
    index("assignment_tables_assignment_idx").on(t.eventId, t.assignmentId),
    index("assignment_tables_table_idx").on(t.eventId, t.tableId),
  ],
);

/**
 * Servis noktasında rol başına gereken personel sayısı. İzin verilen roller eski sistemdeki gibi
 * `service_points.allowed_roles` dizisindedir; bu tablo yalnızca sayısı belirtilen rolleri tutar
 * (sayı > 0). Rol, karşılaştırma için kırpılmış ve küçük harfe çevrilmiş saklanır.
 */
export const servicePointRoleRequirements = pgTable(
  "service_point_role_requirements",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    servicePointId: uuid("service_point_id").notNull(),
    role: text("role").notNull(),
    requiredCount: integer("required_count").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "service_point_role_requirements_service_point_fk",
      columns: [t.eventId, t.servicePointId],
      foreignColumns: [servicePoints.eventId, servicePoints.id],
    }).onDelete("cascade"),
    unique("service_point_role_requirements_point_role_uq").on(t.servicePointId, t.role),
    check("service_point_role_requirements_count_positive", sql`${t.requiredCount} > 0`),
    check("service_point_role_requirements_role_not_blank", sql`btrim(${t.role}) <> ''`),
    index("service_point_role_requirements_point_idx").on(t.eventId, t.servicePointId),
  ],
);

/** Kadro dışı (geçici) etkinlik personeli; staff kaydı yoktur. */
export const eventExtraStaff = pgTable(
  "event_extra_staff",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    position: text("position"),
    role: text("role"),
    shiftStart: time("shift_start"),
    shiftEnd: time("shift_end"),
    color: text("color"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [unique("event_extra_staff_event_id_id_uq").on(t.eventId, t.id)],
);

/** Eski event_extra_staff.assigned_tables (JSON) yerine. */
export const eventExtraStaffTables = pgTable(
  "event_extra_staff_tables",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    extraStaffId: uuid("extra_staff_id").notNull(),
    tableId: uuid("table_id").notNull(),
    ...createdOnly(),
  },
  (t) => [
    foreignKey({
      name: "event_extra_staff_tables_extra_staff_fk",
      columns: [t.eventId, t.extraStaffId],
      foreignColumns: [eventExtraStaff.eventId, eventExtraStaff.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "event_extra_staff_tables_table_fk",
      columns: [t.eventId, t.tableId],
      foreignColumns: [eventTables.eventId, eventTables.id],
    }).onDelete("cascade"),
    unique("event_extra_staff_tables_staff_table_uq").on(t.extraStaffId, t.tableId),
    index("event_extra_staff_tables_extra_staff_idx").on(t.eventId, t.extraStaffId),
    index("event_extra_staff_tables_table_idx").on(t.eventId, t.tableId),
  ],
);

/** Eski event_extra_staff.assigned_groups (JSON) yerine. */
export const eventExtraStaffGroups = pgTable(
  "event_extra_staff_groups",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    extraStaffId: uuid("extra_staff_id").notNull(),
    tableGroupId: uuid("table_group_id").notNull(),
    ...createdOnly(),
  },
  (t) => [
    foreignKey({
      name: "event_extra_staff_groups_extra_staff_fk",
      columns: [t.eventId, t.extraStaffId],
      foreignColumns: [eventExtraStaff.eventId, eventExtraStaff.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "event_extra_staff_groups_group_fk",
      columns: [t.eventId, t.tableGroupId],
      foreignColumns: [tableGroups.eventId, tableGroups.id],
    }).onDelete("cascade"),
    unique("event_extra_staff_groups_staff_group_uq").on(t.extraStaffId, t.tableGroupId),
    index("event_extra_staff_groups_extra_staff_idx").on(t.eventId, t.extraStaffId),
    index("event_extra_staff_groups_group_idx").on(t.eventId, t.tableGroupId),
  ],
);

/**
 * Organizasyon şablonları etkinlikten bağımsız anlık görüntülerdir (ad ile eşleştirme);
 * canlı referans taşımadıkları için JSONB olarak kalır.
 */
export const organizationTemplates = pgTable(
  "organization_templates",
  {
    id: pk(),
    name: text("name").notNull(),
    description: text("description"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    staffAssignments: jsonb("staff_assignments").notNull().default(sql`'[]'::jsonb`),
    teamAssignments: jsonb("team_assignments").notNull().default(sql`'[]'::jsonb`),
    tableGroups: jsonb("table_groups").notNull().default(sql`'[]'::jsonb`),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("organization_templates_created_by_id_idx").on(t.createdById)],
);

/**
 * Etkinlik kısım sorumlusu: etkinliğin tamamında personeli değerlendirebilen atanmış personel
 * (değerlendirme hiyerarşisinin en üstü). Bölüm kapsamı yoktur; etkinlik bazında atanır.
 */
export const eventSectionHeads = pgTable(
  "event_section_heads",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...createdOnly(),
  },
  (t) => [
    unique("event_section_heads_event_staff_uq").on(t.eventId, t.staffId),
    index("event_section_heads_staff_id_idx").on(t.staffId),
  ],
);
