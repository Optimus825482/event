import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pk, timestamps } from "./columns";
import { events } from "./events";
import { staff } from "./people";

export const performanceRating = pgEnum("performance_rating", [
  "very_bad",
  "bad",
  "average",
  "good",
  "successful",
  "excellent",
]);

/** 0–5 arası kategori puanı; değerlendirme taslakken boş olabilir. */
const categoryScore = (name: string) => smallint(name);

function scoreRange(column: AnyPgColumn): SQL {
  return sql`${column} BETWEEN 0 AND 5`;
}

export const staffPerformanceReviews = pgTable(
  "staff_performance_reviews",
  {
    id: pk(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // Genel puan (0–100), kategori puanlarından hesaplanır.
    score: integer("score").notNull(),
    rating: performanceRating("rating").notNull(),
    communication: categoryScore("communication"),
    punctuality: categoryScore("punctuality"),
    teamwork: categoryScore("teamwork"),
    customerService: categoryScore("customer_service"),
    technicalSkills: categoryScore("technical_skills"),
    initiative: categoryScore("initiative"),
    appearance: categoryScore("appearance"),
    stressManagement: categoryScore("stress_management"),
    strengths: text("strengths").array().notNull().default(sql`'{}'::text[]`),
    improvements: text("improvements").array().notNull().default(sql`'{}'::text[]`),
    recommendedTrainings: text("recommended_trainings").array().notNull().default(sql`'{}'::text[]`),
    comment: text("comment"),
    privateNotes: text("private_notes"),
    nextEventNotes: text("next_event_notes"),
    isCompleted: boolean("is_completed").notNull().default(false),
    // Form türü: eski satırlar ayrıntılı ("full"); kısa formda yalnızca genel yıldız puanı vardır.
    formKind: text("form_kind").notNull().default("full"),
    // Kısa formun 1–5 yıldızı; ayrıntılı formda boştur.
    overallRating: smallint("overall_rating"),
    ...timestamps(),
  },
  (t) => [
    unique("staff_performance_reviews_staff_event_reviewer_uq").on(t.staffId, t.eventId, t.reviewerId),
    index("staff_performance_reviews_event_id_idx").on(t.eventId),
    index("staff_performance_reviews_reviewer_id_idx").on(t.reviewerId),
    check("staff_performance_reviews_form_kind_valid", sql`${t.formKind} IN ('short','full')`),
    check(
      "staff_performance_reviews_overall_range",
      sql`${t.overallRating} IS NULL OR ${t.overallRating} BETWEEN 1 AND 5`,
    ),
    check(
      "staff_performance_reviews_short_complete",
      sql`${t.formKind} <> 'short' OR ${t.isCompleted} = false OR ${t.overallRating} IS NOT NULL`,
    ),
    check("staff_performance_reviews_score_range", sql`${t.score} BETWEEN 0 AND 100`),
    check("staff_performance_reviews_communication_range", scoreRange(t.communication)),
    check("staff_performance_reviews_punctuality_range", scoreRange(t.punctuality)),
    check("staff_performance_reviews_teamwork_range", scoreRange(t.teamwork)),
    check("staff_performance_reviews_customer_service_range", scoreRange(t.customerService)),
    check("staff_performance_reviews_technical_skills_range", scoreRange(t.technicalSkills)),
    check("staff_performance_reviews_initiative_range", scoreRange(t.initiative)),
    check("staff_performance_reviews_appearance_range", scoreRange(t.appearance)),
    check("staff_performance_reviews_stress_management_range", scoreRange(t.stressManagement)),
  ],
);
