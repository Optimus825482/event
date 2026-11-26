import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pk, tstz } from "./columns";
import { events, planningStage } from "./events";

/** Planlama aşaması geçiş geçmişi (ileri, geri, yeniden açma). */
export const eventStageTransitions = pgTable(
  "event_stage_transitions",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fromStage: planningStage("from_stage").notNull(),
    toStage: planningStage("to_stage").notNull(),
    kind: text("kind").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    // clock_timestamp(): now() işlem başlangıcını verir, tek işlemdeki geçişlerin sırası belirsiz kalırdı.
    createdAt: tstz("created_at").notNull().default(sql`clock_timestamp()`),
  },
  (t) => [
    check("event_stage_transitions_kind_valid", sql`${t.kind} IN ('advance','revert','reopen')`),
    index("event_stage_transitions_event_created_idx").on(t.eventId, t.createdAt),
  ],
);
