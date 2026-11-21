import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pk, timestamps } from "./columns";
import { events } from "./events";

export const invitationTemplates = pgTable(
  "invitation_templates",
  {
    id: pk(),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    isSystemTemplate: boolean("is_system_template").notNull().default(false),
    size: text("size").notNull().default("A5"),
    width: integer("width").notNull().default(559),
    height: integer("height").notNull().default(794),
    backgroundColor: text("background_color"),
    backgroundImage: text("background_image"),
    backgroundGradient: text("background_gradient"),
    elements: jsonb("elements").notNull().default(sql`'[]'::jsonb`),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    thumbnailUrl: text("thumbnail_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("invitation_templates_created_by_id_idx").on(t.createdById)],
);

/** Etkinliğe özel davetiye tasarımı; `template_id` NULL ise tamamen özel tasarımdır. */
export const eventInvitations = pgTable(
  "event_invitations",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => invitationTemplates.id, { onDelete: "set null" }),
    customElements: jsonb("custom_elements"),
    size: text("size").notNull().default("A5"),
    width: integer("width").notNull().default(559),
    height: integer("height").notNull().default(794),
    backgroundColor: text("background_color"),
    backgroundImage: text("background_image"),
    backgroundGradient: text("background_gradient"),
    eventImages: jsonb("event_images").notNull().default(sql`'[]'::jsonb`),
    companyLogo: text("company_logo"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("event_invitations_event_id_idx").on(t.eventId),
    index("event_invitations_template_id_idx").on(t.templateId),
  ],
);
