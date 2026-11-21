import { isNotNull, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { departments, positions, workLocations } from "./catalog";
import { createdOnly, currency, money, pk, timestamps, tstz } from "./columns";
import { events } from "./events";
import { reservations } from "./reservations";

// Kişiler: `staff` kişi kaydıdır; `users` (auth.ts) oturum hesabıdır.
// `users.staff_id → staff.id` yabancı anahtarı (ON DELETE SET NULL) ve tekilliği
// auth.ts içinde, `users` tablosunun kendi sütun tanımında bildirilir; döngüsel
// içe aktarım (auth ↔ people) yalnızca tembel `references(() => …)` geri
// çağrılarında kullanıldığı için güvenlidir.

export const staffStatus = pgEnum("staff_status", ["active", "inactive", "terminated"]);
export const gender = pgEnum("gender", ["male", "female"]);

export const staff = pgTable(
  "staff",
  {
    id: pk(),
    sicilNo: text("sicil_no").notNull().unique(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    photoPath: text("photo_path"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "restrict" }),
    workLocationId: uuid("work_location_id").references(() => workLocations.id, { onDelete: "restrict" }),
    mentor: text("mentor"),
    color: text("color"),
    gender: gender("gender"),
    birthDate: date("birth_date", { mode: "string" }),
    bloodType: text("blood_type"),
    shoeSize: integer("shoe_size"),
    sockSize: text("sock_size"),
    hireDate: date("hire_date", { mode: "string" }),
    terminationDate: date("termination_date", { mode: "string" }),
    terminationReason: text("termination_reason"),
    yearsAtCompany: integer("years_at_company"),
    status: staffStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [
    index("staff_department_id_idx").on(t.departmentId),
    index("staff_position_id_idx").on(t.positionId),
    index("staff_work_location_id_idx").on(t.workLocationId),
    index("staff_status_idx").on(t.status),
  ],
);

// Eski sistemdeki 10 modül değeri (policy.ts MODULES'tan bağımsız).
export const permissionModule = pgEnum("permission_module", [
  "events",
  "reservations",
  "check_in",
  "staff",
  "customers",
  "venues",
  "settings",
  "users",
  "invitations",
  "notifications",
]);

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: permissionModule("module").notNull(),
    canView: boolean("can_view").notNull().default(true),
    canCreate: boolean("can_create").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    ...timestamps(),
  },
  (t) => [unique("user_permissions_user_module_uq").on(t.userId, t.module)],
);

export const customers = pgTable(
  "customers",
  {
    id: pk(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    vipScore: integer("vip_score").notNull().default(0),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    notes: text("notes"),
    totalSpent: money("total_spent"),
    currency: currency(),
    eventCount: integer("event_count").notNull().default(0),
    totalAttendedEvents: integer("total_attended_events").notNull().default(0),
    totalReservations: integer("total_reservations").notNull().default(0),
    noShowCount: integer("no_show_count").notNull().default(0),
    lastEventAt: tstz("last_event_at"),
    lastEventId: uuid("last_event_id").references(() => events.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("customers_phone_normalized_uq").on(t.phoneNormalized).where(isNotNull(t.phoneNormalized)),
    uniqueIndex("customers_email_normalized_uq").on(t.emailNormalized).where(isNotNull(t.emailNormalized)),
    index("customers_full_name_idx").on(t.fullName),
    index("customers_last_event_id_idx").on(t.lastEventId),
    check("customers_total_spent_non_negative", sql`${t.totalSpent} >= 0`),
  ],
);

export const customerTags = pgTable(
  "customer_tags",
  {
    id: pk(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    ...createdOnly(),
  },
  (t) => [unique("customer_tags_customer_tag_uq").on(t.customerId, t.tag), index("customer_tags_tag_idx").on(t.tag)],
);

export const guestNoteType = pgEnum("guest_note_type", ["pre_event", "during_event", "post_event", "general"]);

export const guestNotes = pgTable(
  "guest_notes",
  {
    id: pk(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    noteType: guestNoteType("note_type").notNull().default("general"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("guest_notes_customer_id_idx").on(t.customerId),
    index("guest_notes_event_id_idx").on(t.eventId),
    index("guest_notes_reservation_id_idx").on(t.reservationId),
    index("guest_notes_created_by_id_idx").on(t.createdById),
  ],
);
