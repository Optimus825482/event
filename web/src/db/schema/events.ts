import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import { EVENT_STATUSES } from "../../domain/event-status";
import { PLANNING_STAGES } from "../../domain/planning-stage";
import type { SaleCategory, TableAllocation } from "../../domain/seating";
import { users } from "./auth";
import { tableTypes } from "./catalog";
import { pk, timestamps, tstz } from "./columns";

export const eventStatus = pgEnum("event_status", EVENT_STATUSES);
export const planningStage = pgEnum("planning_stage", PLANNING_STAGES);

export const venueTemplates = pgTable(
  "venue_templates",
  {
    id: pk(),
    name: text("name").notNull(),
    description: text("description"),
    layoutData: jsonb("layout_data").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    thumbnail: text("thumbnail"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    usageCount: integer("usage_count").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("venue_templates_created_by_id_idx").on(t.createdById)],
);

export const events = pgTable(
  "events",
  {
    id: pk(),
    name: text("name").notNull(),
    description: text("description"),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at"),
    // Masa olmayan yerleşim öğeleri (duvar, sahne, boyutlar). Masalar `event_tables` satırlarıdır.
    layoutDecor: jsonb("layout_decor"),
    status: eventStatus("status").notNull().default("draft"),
    eventType: text("event_type"),
    coverImage: text("cover_image"),
    totalCapacity: integer("total_capacity").notNull().default(0),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    venueTemplateId: uuid("venue_template_id").references(() => venueTemplates.id, { onDelete: "set null" }),
    reviewEnabled: boolean("review_enabled").notNull().default(false),
    reviewHistoryVisible: boolean("review_history_visible").notNull().default(false),
    reservationEnabled: boolean("reservation_enabled").notNull().default(true),
    planningStage: planningStage("planning_stage").notNull().default("defined"),
    stageChangedAt: tstz("stage_changed_at"),
    /** Serbest metin sanatçı adı; sanatçı kaydı gelince ilişkiye çevrilecek. */
    artistName: text("artist_name"),
    ...timestamps(),
  },
  (t) => [
    check("events_ends_after_starts", sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    index("events_organizer_id_idx").on(t.organizerId, t.startsAt),
    index("events_status_starts_at_idx").on(t.status, t.startsAt),
    index("events_venue_template_id_idx").on(t.venueTemplateId),
  ],
);

export const eventTables = pgTable(
  "event_tables",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tableTypeId: uuid("table_type_id").references(() => tableTypes.id, { onDelete: "restrict" }),
    capacity: integer("capacity").notNull(),
    x: doublePrecision("x").notNull().default(0),
    y: doublePrecision("y").notNull().default(0),
    rotation: doublePrecision("rotation").notNull().default(0),
    isLoca: boolean("is_loca").notNull().default(false),
    isVip: boolean("is_vip").notNull().default(false),
    /** Düzenleyicide sabitlenmiş (taşınmaz); "kullanımda" (rezervasyonlu) kavramından bağımsızdır. */
    isPinned: boolean("is_pinned").notNull().default(false),
    /** Çizim boyutu (px; yuvarlak için çap, diğerleri için uzun kenar). null = kapasiteden türetilir. */
    size: doublePrecision("size"),
    floor: smallint("floor").notNull().default(1),
    /** Sayısal sıralama anahtarı (etiketten bağımsız). */
    sortNumber: integer("sort_number"),
    /** Satış kategorisi (`SALE_CATEGORIES`); fiyat kategoriye göre belirlenir. */
    saleCategory: text("sale_category").$type<SaleCategory>().notNull().default("standard"),
    /** Satılabilir sandalye sayısı; null = kapasite. */
    sellableSeats: integer("sellable_seats"),
    /** Tahsis (`TABLE_ALLOCATIONS`): masanın Casino'ya mı online satışa mı ayrıldığı. */
    allocation: text("allocation").$type<TableAllocation>().notNull().default("pending"),
    ...timestamps(),
  },
  (t) => [
    check("event_tables_capacity_positive", sql`${t.capacity} > 0`),
    check("event_tables_sale_category_valid", sql`${t.saleCategory} IN ('standard', 'premium', 'vip')`),
    check(
      "event_tables_sellable_within_capacity",
      sql`${t.sellableSeats} IS NULL OR (${t.sellableSeats} >= 1 AND ${t.sellableSeats} <= ${t.capacity})`,
    ),
    check("event_tables_allocation_valid", sql`${t.allocation} IN ('pending', 'casino', 'online', 'closed')`),
    check("event_tables_floor_range", sql`${t.floor} BETWEEN 1 AND 9`),
    unique("event_tables_event_label_uq").on(t.eventId, t.label),
    // Bağlı tabloların bileşik yabancı anahtarı (event_id, table_id) için hedef:
    // bir masa yalnızca kendi etkinliğinin satırlarınca referans alınabilir.
    unique("event_tables_event_id_id_uq").on(t.eventId, t.id),
    // Tahsise bağlı bileşik yabancı anahtarların hedefi (rezervasyon → casino, yuva → online).
    unique("event_tables_event_id_id_allocation_uq").on(t.eventId, t.id, t.allocation),
    index("event_tables_table_type_id_idx").on(t.tableTypeId),
  ],
);

export const servicePoints = pgTable(
  "service_points",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pointType: text("point_type").notNull().default("bar"),
    requiredStaffCount: integer("required_staff_count").notNull().default(1),
    allowedRoles: text("allowed_roles").array().notNull().default(sql`'{}'::text[]`),
    x: doublePrecision("x").notNull().default(0),
    y: doublePrecision("y").notNull().default(0),
    color: text("color").notNull().default("#06b6d4"),
    shape: text("shape").notNull().default("square"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    // Yerleşim planındaki bar öğesinin kimliği (`layout_decor.elements[].id`); dolu ise nokta plandan yönetilir.
    layoutElementId: text("layout_element_id"),
    ...timestamps(),
  },
  (t) => [
    check("service_points_required_staff_non_negative", sql`${t.requiredStaffCount} >= 0`),
    unique("service_points_event_id_id_uq").on(t.eventId, t.id),
    unique("service_points_event_layout_element_uq").on(t.eventId, t.layoutElementId),
  ],
);

export const workShifts = pgTable(
  "work_shifts",
  {
    id: pk(),
    name: text("name").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    // NULL: genel vardiya; dolu: etkinliğe özel vardiya.
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  // Ad kapsam başına tekildir: genel vardiyalar (event_id NULL) kendi aralarında da.
  (t) => [unique("work_shifts_event_name_uq").on(t.eventId, t.name).nullsNotDistinct()],
);
