import * as schema from "@/db/schema";
import { timestamps } from "./catalogs";
import { type Ctx, isRecord, jsonStrings } from "./context";
import { byCreatedThenId } from "./values";

/** Davetiyeler, bildirimler ve personel değerlendirmeleri. */

const CATEGORY_FIELDS = [
  ["communication", "communication"],
  ["punctuality", "punctuality"],
  ["teamwork", "teamwork"],
  ["customerService", "customerService"],
  ["technicalSkills", "technicalSkills"],
  ["initiative", "initiative"],
  ["appearance", "appearance"],
  ["stressManagement", "stressManagement"],
] as const;

type ReviewCategory = (typeof CATEGORY_FIELDS)[number][1];

export async function migrateContent(ctx: Ctx): Promise<void> {
  const L = ctx.legacy;
  const templateIds = new Set(L.invitation_templates.map((r) => r.id));
  await ctx.w.insert(
    schema.invitationTemplates,
    L.invitation_templates.map((r) => ({
      id: r.id,
      name: r.text("name"),
      description: r.str("description"),
      isDefault: r.bool("isDefault", false),
      isSystemTemplate: r.bool("isSystemTemplate", false),
      size: r.text("size", "A5"),
      width: r.int("width") ?? 559,
      height: r.int("height") ?? 794,
      backgroundColor: r.str("backgroundColor"),
      backgroundImage: r.str("backgroundImage"),
      backgroundGradient: r.str("backgroundGradient"),
      elements: r.json("elements") ?? [],
      createdById: ctx.resolveUser(r.str("createdById")),
      thumbnailUrl: r.str("thumbnailUrl"),
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await ctx.w.insert(
    schema.eventInvitations,
    L.event_invitations.flatMap((r) => {
      const eventId = ctx.resolveEvent(r.str("eventId"));
      if (eventId === null) {
        ctx.add("skippedRows", { table: "event_invitations", id: r.id, reason: "eventId geçerli bir etkinlik değil", ref: r.str("eventId") });
        return [];
      }
      const templateId = r.str("templateId");
      return [
        {
          id: r.id,
          eventId,
          templateId: templateId !== null && templateIds.has(templateId) ? templateId : null,
          customElements: r.json("customElements"),
          size: r.text("size", "A5"),
          width: r.int("width") ?? 559,
          height: r.int("height") ?? 794,
          backgroundColor: r.str("backgroundColor"),
          backgroundImage: r.str("backgroundImage"),
          backgroundGradient: r.str("backgroundGradient"),
          eventImages: r.json("eventImages") ?? [],
          companyLogo: r.str("companyLogo"),
          isActive: r.bool("isActive", true),
          ...timestamps(r),
        },
      ];
    }),
  );
  const notificationIds = new Set(L.notifications.map((r) => r.id));
  await ctx.w.insert(
    schema.notifications,
    L.notifications.map((r) => ({
      id: r.id,
      type: r.text("type") as (typeof schema.notificationType.enumValues)[number],
      title: r.text("title"),
      message: r.text("message"),
      priority: r.text("priority", "medium") as (typeof schema.notificationPriority.enumValues)[number],
      audience: r.text("targetRole", "all") as (typeof schema.notificationAudience.enumValues)[number],
      eventId: ctx.resolveEvent(r.str("eventId")),
      createdById: ctx.resolveUser(r.str("createdById")),
      metadata: r.json("metadata"),
      actionUrl: r.str("actionUrl"),
      isActive: r.bool("isActive", true),
      createdAt: r.date("createdAt") ?? undefined,
      updatedAt: r.date("createdAt") ?? undefined,
    })),
  );
  await ctx.w.insert(
    schema.notificationReads,
    L.notification_reads
      .filter((r) => notificationIds.has(r.text("notificationId")) && ctx.resolveUser(r.str("userId")) !== null)
      .map((r) => ({
        id: r.id,
        notificationId: r.text("notificationId"),
        userId: r.text("userId"),
        readAt: r.date("readAt") ?? undefined,
        createdAt: r.date("readAt") ?? undefined,
      })),
  );
  await migrateReviews(ctx);
}

function categoryScores(ctx: Ctx, id: string, raw: unknown): Record<ReviewCategory, number | null> {
  const src = isRecord(raw) ? raw : {};
  const out = {} as Record<ReviewCategory, number | null>;
  for (const [legacyKey, key] of CATEGORY_FIELDS) {
    const v = src[legacyKey];
    if (v === undefined || v === null) {
      out[key] = null;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      ctx.add("invalidValues", { table: "staff_performance_reviews", id, field: `categoryScores.${legacyKey}`, from: String(v), to: null });
      out[key] = null;
    } else {
      out[key] = Math.round(n);
      if (out[key] !== n) ctx.add("invalidValues", { table: "staff_performance_reviews", id, field: `categoryScores.${legacyKey}`, from: n, to: out[key] });
    }
  }
  return out;
}

async function migrateReviews(ctx: Ctx): Promise<void> {
  const seen = new Map<string, string>();
  const rows = [...ctx.legacy.staff_performance_reviews].sort(byCreatedThenId).flatMap((r) => {
    const staffId = ctx.resolveStaff(r.str("staffId"));
    const reviewerId = ctx.resolveUser(r.str("reviewerId"));
    if (staffId === null || reviewerId === null) {
      ctx.add(staffId === null ? "unresolvedStaffReferences" : "skippedRows", {
        table: "staff_performance_reviews",
        id: r.id,
        field: staffId === null ? "staffId" : "reviewerId",
        ref: staffId === null ? r.str("staffId") : r.str("reviewerId"),
        action: "satır atlandı",
      });
      return [];
    }
    const eventId = r.text("eventId");
    const key = `${staffId}:${eventId}:${reviewerId}`;
    const prev = seen.get(key);
    if (prev) {
      ctx.add("reviewConflicts", { id: r.id, keptReviewId: prev, staffId, eventId, reviewerId, action: "atlandı" });
      return [];
    }
    seen.set(key, r.id);
    const score = r.int("score") ?? 0;
    const clamped = Math.min(100, Math.max(0, score));
    if (clamped !== score) ctx.add("invalidValues", { table: "staff_performance_reviews", id: r.id, field: "score", from: score, to: clamped });
    return [
      {
        id: r.id,
        staffId,
        reviewerId,
        eventId,
        score: clamped,
        rating: r.text("rating") as (typeof schema.performanceRating.enumValues)[number],
        ...categoryScores(ctx, r.id, r.json("categoryScores")),
        strengths: jsonStrings(r.json("strengths")),
        improvements: jsonStrings(r.json("improvements")),
        recommendedTrainings: jsonStrings(r.json("recommendedTrainings")),
        comment: r.str("comment"),
        privateNotes: r.str("privateNotes"),
        nextEventNotes: r.str("nextEventNotes"),
        isCompleted: r.bool("isCompleted", false),
        ...timestamps(r),
      },
    ];
  });
  await ctx.w.insert(schema.staffPerformanceReviews, rows);
}
