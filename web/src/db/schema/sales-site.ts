import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps, tstz } from "./columns";
import { events } from "./events";

/** Etkinlik başına satış sitesi içeriği; satır yoksa tüm alanlar boş kabul edilir. */
export const eventSiteContent = pgTable("event_site_content", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),
  heroImage: text("hero_image"),
  summary: text("summary"),
  doorsOpenAt: tstz("doors_open_at"),
  ageLimit: text("age_limit"),
  dressCode: text("dress_code"),
  sightlineSet: text("sightline_set"),
  ...timestamps(),
});
