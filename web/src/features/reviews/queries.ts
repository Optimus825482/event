import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, staffPerformanceReviews, teamMembers, teams } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { authorizeReviewsGate, loadReviewEvent, type ReviewRow } from "./service";
import type { ReviewFormKind } from "./form-kinds";
import { RATING_KEYS, type RatingBand, type RatingKey } from "./score";
import { ownTeamOnly } from "@/features/auth/scope";

type Executor = Db | Tx;

export type ReviewView = {
  id: string;
  formKind: ReviewFormKind;
  overallRating: number | null;
  score: number;
  band: RatingBand;
  ratings: Record<RatingKey, number | null>;
  strengths: string[];
  improvements: string[];
  recommendedTrainings: string[];
  comment: string | null;
  privateNotes: string | null;
  nextEventNotes: string | null;
  isCompleted: boolean;
  updatedAt: string;
};

export type BoardMember = { staffId: string; fullName: string; review: ReviewView | null };
export type BoardTeam = { id: string; name: string; color: string; members: BoardMember[] };
export type ReviewBoard = {
  event: { id: string; name: string; startsAt: string; status: string; reviewEnabled: boolean };
  teams: BoardTeam[];
};

export type ReviewableEvent = {
  id: string;
  name: string;
  startsAt: string;
  status: string;
  reviewEnabled: boolean;
  teamCount: number;
  memberCount: number;
  completedCount: number;
};

function toView(row: ReviewRow): ReviewView {
  return {
    id: row.id,
    formKind: row.formKind as ReviewFormKind,
    overallRating: row.overallRating,
    score: row.score,
    band: row.rating,
    ratings: Object.fromEntries(RATING_KEYS.map((key) => [key, row[key]])) as Record<RatingKey, number | null>,
    strengths: row.strengths,
    improvements: row.improvements,
    recommendedTrainings: row.recommendedTrainings,
    comment: row.comment,
    privateNotes: row.privateNotes,
    nextEventNotes: row.nextEventNotes,
    isCompleted: row.isCompleted,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Aktörün değerlendirebileceği ekipler: lider yalnızca kendi ekibini görür. */
async function visibleTeams(executor: Executor, actor: Actor, eventIds?: string[]) {
  const conditions = [eq(teams.isActive, true)];
  if (eventIds) conditions.push(inArray(teams.eventId, eventIds));
  if (ownTeamOnly(actor)) {
    if (!actor.staffId) return [];
    conditions.push(eq(teams.leaderStaffId, actor.staffId));
  }
  return executor.select().from(teams).where(and(...conditions)).orderBy(asc(teams.sortOrder), asc(teams.name));
}

async function membersOf(executor: Executor, teamRows: { id: string; leaderStaffId: string | null }[]) {
  if (teamRows.length === 0) return [];
  const rows = await executor
    .select({ teamId: teamMembers.teamId, staffId: staff.id, fullName: staff.fullName })
    .from(teamMembers)
    .innerJoin(staff, eq(staff.id, teamMembers.staffId))
    .where(
      inArray(
        teamMembers.teamId,
        teamRows.map((t) => t.id),
      ),
    )
    .orderBy(asc(staff.fullName));
  const leaderOf = new Map(teamRows.map((t) => [t.id, t.leaderStaffId]));
  // Lider kendini değerlendirmez; listeden çıkarılır.
  return rows.filter((r) => leaderOf.get(r.teamId) !== r.staffId);
}

/** Değerlendirilecek ekip üyesi olan etkinlikler (en yeni önce). */
export async function listReviewableEvents(executor: Executor, actor: Actor): Promise<ReviewableEvent[]> {
  authorizeReviewsGate(actor, "view");
  const baseTeams = await visibleTeams(executor, actor);
  const eventIds = [...new Set(baseTeams.flatMap((t) => (t.eventId ? [t.eventId] : [])))];
  if (eventIds.length === 0) return [];

  const eventRows = await executor
    .select()
    .from(events)
    .where(inArray(events.id, eventIds))
    .orderBy(desc(events.startsAt))
    .limit(100);
  const allowed = eventRows;
  if (allowed.length === 0) return [];
  const allowedIds = new Set(allowed.map((e) => e.id));
  const teamRows = baseTeams.filter((t) => t.eventId && allowedIds.has(t.eventId));

  const members = await membersOf(executor, teamRows);
  const completed = await executor
    .select({ eventId: staffPerformanceReviews.eventId, staffId: staffPerformanceReviews.staffId })
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.reviewerId, actor.id),
        eq(staffPerformanceReviews.isCompleted, true),
        inArray(staffPerformanceReviews.eventId, [...allowedIds]),
      ),
    );
  const completedKeys = new Set(completed.map((c) => `${c.eventId}:${c.staffId}`));
  const teamEvent = new Map(teamRows.map((t) => [t.id, t.eventId]));

  return allowed.map((e) => {
    const eventTeams = teamRows.filter((t) => t.eventId === e.id);
    const eventMembers = members.filter((m) => teamEvent.get(m.teamId) === e.id);
    return {
      id: e.id,
      name: e.name,
      startsAt: e.startsAt.toISOString(),
      status: e.status,
      reviewEnabled: e.reviewEnabled,
      teamCount: eventTeams.length,
      memberCount: eventMembers.length,
      completedCount: eventMembers.filter((m) => completedKeys.has(`${e.id}:${m.staffId}`)).length,
    };
  });
}

/** Etkinliğin ekipleri, üyeleri ve aktörün kendi değerlendirmeleri. Lider yalnızca kendi ekibini görür. */
export async function getReviewBoard(executor: Executor, actor: Actor, eventId: string): Promise<ReviewBoard> {
  authorizeReviewsGate(actor, "view");
  const event = await loadReviewEvent(executor, actor, eventId);
  const teamRows = await visibleTeams(executor, actor, [eventId]);
  // Lider bu etkinlikte ekip yönetmiyorsa: kaynak sahipliği olmadan görüntüleme reddedilir.
  if (teamRows.length === 0 && ownTeamOnly(actor)) authorize(actor, "reviews", "view", {});
  if (teamRows.length === 0 && !ownTeamOnly(actor)) {
    return { event: toEvent(event), teams: [] };
  }
  for (const team of teamRows) {
    authorize(actor, "reviews", "view", team.leaderStaffId ? { teamLeaderStaffId: team.leaderStaffId } : {});
  }

  const members = await membersOf(executor, teamRows);
  const reviewRows =
    members.length === 0
      ? []
      : await executor
          .select()
          .from(staffPerformanceReviews)
          .where(
            and(
              eq(staffPerformanceReviews.eventId, eventId),
              eq(staffPerformanceReviews.reviewerId, actor.id),
              inArray(
                staffPerformanceReviews.staffId,
                members.map((m) => m.staffId),
              ),
            ),
          );
  const reviewByStaff = new Map(reviewRows.map((r) => [r.staffId, r]));

  return {
    event: toEvent(event),
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      members: members
        .filter((m) => m.teamId === t.id)
        .map((m) => {
          const review = reviewByStaff.get(m.staffId);
          return { staffId: m.staffId, fullName: m.fullName, review: review ? toView(review) : null };
        }),
    })),
  };
}

function toEvent(event: typeof events.$inferSelect): ReviewBoard["event"] {
  return {
    id: event.id,
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    reviewEnabled: event.reviewEnabled,
  };
}
