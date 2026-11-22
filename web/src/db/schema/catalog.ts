import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdOnly, currency, money, pk, timestamps } from "./columns";

// Kataloglar: personel kayıtlarının yabancı anahtarla bağlandığı ana listeler.

export const departments = pgTable(
  "departments",
  {
    id: pk(),
    name: text("name").notNull().unique(),
    description: text("description"),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("departments_is_active_idx").on(t.isActive)],
);

export const positions = pgTable(
  "positions",
  {
    id: pk(),
    name: text("name").notNull().unique(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("positions_is_active_idx").on(t.isActive)],
);

export const workLocations = pgTable(
  "work_locations",
  {
    id: pk(),
    name: text("name").notNull().unique(),
    description: text("description"),
    address: text("address"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("work_locations_is_active_idx").on(t.isActive)],
);

export const departmentPositions = pgTable(
  "department_positions",
  {
    id: pk(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    ...createdOnly(),
  },
  (t) => [
    unique("department_positions_department_position_uq").on(t.departmentId, t.positionId),
    index("department_positions_position_id_idx").on(t.positionId),
  ],
);

export const departmentLocations = pgTable(
  "department_locations",
  {
    id: pk(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    workLocationId: uuid("work_location_id")
      .notNull()
      .references(() => workLocations.id, { onDelete: "cascade" }),
    ...createdOnly(),
  },
  (t) => [
    unique("department_locations_department_location_uq").on(t.departmentId, t.workLocationId),
    index("department_locations_work_location_id_idx").on(t.workLocationId),
  ],
);

export const staffRoles = pgTable("staff_roles", {
  id: pk(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  badgeColor: text("badge_color").notNull().default("bg-blue-500/20 text-blue-400 border-blue-500/30"),
  bgColor: text("bg_color").notNull().default("bg-blue-500"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});

export const tableTypes = pgTable(
  "table_types",
  {
    id: pk(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    icon: text("icon"),
    basePrice: money("base_price"),
    currency: currency(),
    shape: text("shape").notNull().default("round"),
    capacity: integer("capacity").notNull().default(8),
    minSpacing: integer("min_spacing").notNull().default(50),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check("table_types_capacity_positive", sql`${t.capacity} > 0`),
    check("table_types_base_price_non_negative", sql`${t.basePrice} >= 0`),
  ],
);
