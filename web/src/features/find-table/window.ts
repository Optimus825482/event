import { sql } from "drizzle-orm";
import { events } from "@/db/schema";

/** Arama ve görüntülemede ortak etkinlik penceresi: yayında/devam eden/biten ve bitişten en çok 12 saat sonrası. */
export function eventWindowOpen() {
  return sql`(${events.status} in ('published', 'active', 'completed') and clock_timestamp() <= coalesce(${events.endsAt}, ${events.startsAt}) + interval '12 hours')`;
}
