import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, staffPerformanceReviews, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { reviewEventIds, reviewableStaff, type ReviewBasis } from "./authority";
import { reviewableByEvent } from "./leader-scope";
import { authorizeEventScope, authorizeReviewsGate, loadReviewEvent, type ReviewRow } from "./service";
import type { ReviewFormKind } from "./form-kinds";
import { RATING_KEYS, type RatingBand, type RatingKey } from "./score";

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

export type BoardMember = { staffId: string; fullName: string; bases: ReviewBasis[]; review: ReviewView | null };
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

/** Hiçbir etkin ekipte olmayan değerlendirilebilir personelin listelendiği sahte ekip. */
const OUTSIDE_TEAM = { id: "ekip-disi", name: "Ekip dışı personel", color: "#64748b" } as const;

type TeamRef = { id: string; name: string; color: string };
type Grouped = { team: TeamRef; staffIds: string[] };

/** Etkinliklerin etkin ekipleri (`sortOrder, name`) ve her ekibin kişileri (üyeler + lider). */
async function teamsWithPeople(executor: Executor, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const teamRows = await executor
    .select({ id: teams.id, eventId: teams.eventId, name: teams.name, color: teams.color, leaderStaffId: teams.leaderStaffId })
    .from(teams)
    .where(and(eq(teams.isActive, true), inArray(teams.eventId, eventIds)))
    .orderBy(asc(teams.sortOrder), asc(teams.name));
  const memberRows =
    teamRows.length === 0
      ? []
      : await executor
          .select({ teamId: teamMembers.teamId, staffId: teamMembers.staffId })
          .from(teamMembers)
          .where(
            inArray(
              teamMembers.teamId,
              teamRows.map((t) => t.id),
            ),
          );
  return teamRows.map((t) => {
    const people = new Set(memberRows.filter((m) => m.teamId === t.id).map((m) => m.staffId));
    if (t.leaderStaffId) people.add(t.leaderStaffId);
    return { team: { id: t.id, name: t.name, color: t.color }, eventId: t.eventId, people };
  });
}

/**
 * Değerlendirilebilir personeli ekiplere dağıtır: her kişi içinde bulunduğu ilk ekipte bir kez yer alır;
 * hiçbir ekipte olmayanlar `OUTSIDE_TEAM` altında. Boş ekipler dönmez.
 */
function groupByTeam(
  eventTeams: { team: TeamRef; people: Set<string> }[],
  reviewable: ReadonlyMap<string, ReviewBasis[]>,
): Grouped[] {
  const placed = new Set<string>();
  const groups: Grouped[] = [];
  for (const { team, people } of eventTeams) {
    const ids = [...people].filter((id) => reviewable.has(id) && !placed.has(id));
    for (const id of ids) placed.add(id);
    if (ids.length > 0) groups.push({ team, staffIds: ids });
  }
  const outside = [...reviewable.keys()].filter((id) => !placed.has(id));
  if (outside.length > 0) groups.push({ team: { ...OUTSIDE_TEAM }, staffIds: outside });
  return groups;
}

/** Değerlendirilecek personeli olan etkinlikler (en yeni önce); sayılar panodaki kümeden hesaplanır. */
export async function listReviewableEvents(executor: Executor, actor: Actor): Promise<ReviewableEvent[]> {
  authorizeReviewsGate(actor, "view");
  const eventIds = await reviewEventIds(executor, actor);
  if (eventIds.length === 0) return [];

  const allowed = await executor
    .select()
    .from(events)
    .where(inArray(events.id, eventIds))
    .orderBy(desc(events.startsAt))
    .limit(100);
  if (allowed.length === 0) return [];
  const allowedIds = allowed.map((e) => e.id);
  const reviewable = await reviewableByEvent(executor, actor, allowedIds);
  const eventTeams = await teamsWithPeople(executor, allowedIds);

  const completed = await executor
    .select({ eventId: staffPerformanceReviews.eventId, staffId: staffPerformanceReviews.staffId })
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.reviewerId, actor.id),
        eq(staffPerformanceReviews.isCompleted, true),
        inArray(staffPerformanceReviews.eventId, allowedIds),
      ),
    );
  const completedKeys = new Set(completed.map((c) => `${c.eventId}:${c.staffId}`));

  return allowed.map((e) => {
    const set = reviewable.get(e.id) ?? new Map<string, ReviewBasis[]>();
    const groups = groupByTeam(
      eventTeams.filter((t) => t.eventId === e.id),
      set,
    );
    return {
      id: e.id,
      name: e.name,
      startsAt: e.startsAt.toISOString(),
      status: e.status,
      reviewEnabled: e.reviewEnabled,
      teamCount: groups.length,
      memberCount: set.size,
      completedCount: [...set.keys()].filter((id) => completedKeys.has(`${e.id}:${id}`)).length,
    };
  });
}

/**
 * Etkinlikte aktörün değerlendirebildiği personel, ekiplere göre gruplu, ve aktörün kendi değerlendirmeleri.
 * Hiyerarşi aktörü bu etkinlikte kimseyi değerlendiremiyorsa reddedilir.
 */
export async function getReviewBoard(executor: Executor, actor: Actor, eventId: string): Promise<ReviewBoard> {
  authorizeReviewsGate(actor, "view");
  const event = await loadReviewEvent(executor, actor, eventId);
  const reviewable = await reviewableStaff(executor, actor, eventId);
  authorizeEventScope(actor, "view", reviewable);
  if (reviewable.size === 0) return { event: toEvent(event), teams: [] };

  const staffIds = [...reviewable.keys()];
  const people = await executor
    .select({ id: staff.id, fullName: staff.fullName })
    .from(staff)
    .where(inArray(staff.id, staffIds))
    .orderBy(asc(staff.fullName));
  const nameOf = new Map(people.map((p) => [p.id, p.fullName]));
  const order = new Map(people.map((p, i) => [p.id, i]));
  const reviewRows = await executor
    .select()
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.eventId, eventId),
        eq(staffPerformanceReviews.reviewerId, actor.id),
        inArray(staffPerformanceReviews.staffId, staffIds),
      ),
    );
  const reviewByStaff = new Map(reviewRows.map((r) => [r.staffId, r]));
  const groups = groupByTeam(await teamsWithPeople(executor, [eventId]), reviewable);

  return {
    event: toEvent(event),
    teams: groups.map(({ team, staffIds: ids }) => ({
      ...team,
      members: ids
        .filter((id) => nameOf.has(id))
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
        .map((id) => {
          const review = reviewByStaff.get(id);
          return {
            staffId: id,
            fullName: nameOf.get(id) ?? "",
            bases: reviewable.get(id) ?? [],
            review: review ? toView(review) : null,
          };
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
