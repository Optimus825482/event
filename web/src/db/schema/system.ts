import { boolean, index, integer, jsonb, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdOnly, pk, timestamps, tstz } from "./columns";
import { events } from "./events";

export const systemSettings = pgTable("system_settings", {
  id: pk(),
  companyName: text("company_name").notNull().default("EventFlow"),
  logo: text("logo"),
  // Kullanılmıyor: uygulama yalnızca APP_TIME_ZONE kullanır; sütun sonraki bir temizliğe kadar duruyor.
  timezone: text("timezone").notNull().default("Asia/Famagusta"),
  language: text("language").notNull().default("tr"),
  defaultGridSize: integer("default_grid_size").notNull().default(20),
  snapToGrid: boolean("snap_to_grid").notNull().default(true),
  showGridByDefault: boolean("show_grid_by_default").notNull().default(true),
  defaultGuestCount: integer("default_guest_count").notNull().default(2),
  allowOverbooking: boolean("allow_overbooking").notNull().default(false),
  requirePhoneNumber: boolean("require_phone_number").notNull().default(true),
  requireEmail: boolean("require_email").notNull().default(false),
  autoCheckInEnabled: boolean("auto_check_in_enabled").notNull().default(false),
  checkInSoundEnabled: boolean("check_in_sound_enabled").notNull().default(true),
  showTableDirections: boolean("show_table_directions").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  smsNotifications: boolean("sms_notifications").notNull().default(false),
  qrCodeSystemEnabled: boolean("qr_code_system_enabled").notNull().default(true),
  invitationSystemEnabled: boolean("invitation_system_enabled").notNull().default(true),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpUser: text("smtp_user"),
  // Uygulama anahtarıyla şifrelenmiş değer; düz parola asla saklanmaz.
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  smtpFromEmail: text("smtp_from_email"),
  smtpFromName: text("smtp_from_name"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  ...timestamps(),
});

export const notificationType = pgEnum("notification_type", [
  "event_created",
  "event_updated",
  "event_cancelled",
  "venue_layout_completed",
  "team_organization_completed",
  "review_system_activated",
  "review_system_deactivated",
  "staff_review_completed",
  "staff_review_updated",
  "reservation_system_activated",
  "reservation_system_deactivated",
  "team_assignment_changed",
  "staff_added_to_team",
  "staff_removed_from_team",
  "table_group_changed",
  "new_staff_added",
  "system_announcement",
]);
export const notificationPriority = pgEnum("notification_priority", ["low", "medium", "high", "urgent"]);
export const notificationAudience = pgEnum("notification_audience", ["all", "admin", "entertainment", "fnb", "casino"]);

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    priority: notificationPriority("priority").notNull().default("medium"),
    audience: notificationAudience("audience").notNull().default("all"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    actionUrl: text("action_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("notifications_audience_created_at_idx").on(t.audience, t.createdAt),
    index("notifications_type_created_at_idx").on(t.type, t.createdAt),
    index("notifications_event_id_idx").on(t.eventId),
    index("notifications_created_by_id_idx").on(t.createdById),
  ],
);

export const notificationReads = pgTable(
  "notification_reads",
  {
    id: pk(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: tstz("read_at").notNull().defaultNow(),
    ...createdOnly(),
  },
  (t) => [
    unique("notification_reads_notification_user_uq").on(t.notificationId, t.userId),
    index("notification_reads_user_read_at_idx").on(t.userId, t.readAt),
  ],
);

export const staffColors = pgTable("staff_colors", {
  id: pk(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});
