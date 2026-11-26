import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventStaffAssignments,
  eventTables,
  events,
  reservations,
  staff,
  staffPerformanceReviews,
  tableGroupTables,
  tableGroups,
} from "@/db/schema";
import { ACTIVE_RESERVATION_STATUSES } from "@/domain/reservation-status";
import type { Actor } from "@/features/auth/session";
import { getFloorPlan } from "@/features/venue/plan-service";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { DomainError } from "@/lib/action";
import { reviewableByEvent, scopedMembers, scopedTeams, type ScopedTeam } from "./leader-scope";
import { average, categoryAverages, countdownParts, trendOf, type Trend } from "./leader-stats";
import { reviewEventIds, reviewableStaff } from "./authority";
import { OUTSIDE_TEAM, listReviewableEvents, type ReviewableEvent } from "./queries";
import { RATING_KEYS, ratingBand, type RatingBand, type RatingKey } from "./score";

type Executor = Db | Tx;

const NOT_FOUND_EVENT = "Etkinlik bulunamadı";
const NOT_FOUND_MEMBER = "Ekip üyesi bulunamadı";
const UPCOMING = new Set(["draft", "published", "active"]);

export type LeaderEventRef = { id: string; name: string; startsAt: string; status: string };

export type LeaderDashboard = {
  teamCount: number;
  memberCount: number;
  eventCount: number;
  upcoming: LeaderEventRef[];
  next: LeaderEventRef | null;
  /** Sıradaki etkinliğe kalan tam gün ve saat (geçmişse null). */
  countdown: { days: number; hours: number } | null;
  pendingReviewEvents: number;
};

function eventRefs(teamRows: ScopedTeam[]): LeaderEventRef[] {
  const seen = new Map<string, LeaderEventRef>();
  for (const t of teamRows) {
    if (t.eventId && t.eventName && t.eventStartsAt && t.eventStatus && !seen.has(t.eventId)) {
      seen.set(t.eventId, {
        id: t.eventId,
        name: t.eventName,
        startsAt: t.eventStartsAt.toISOString(),
        status: t.eventStatus,
      });
    }
  }
  return [...seen.values()];
}

function unionRefs(refs: LeaderEventRef[], reviewable: ReviewableEvent[]): LeaderEventRef[] {
  const seen = new Map(refs.map((r) => [r.id, r]));
  for (const e of reviewable) {
    if (!seen.has(e.id)) seen.set(e.id, { id: e.id, name: e.name, startsAt: e.startsAt, status: e.status });
  }
  return [...seen.values()];
}

function isUpcoming(event: LeaderEventRef, now: Date): boolean {
  return UPCOMING.has(event.status) && new Date(event.startsAt).getTime() >= now.getTime();
}

/** Lider panosu: yalnızca aktörün kapsamındaki ekipler, üyeler ve etkinlikler. */
export async function getLeaderDashboard(
  executor: Executor,
  actor: Actor,
  now: Date = new Date(),
): Promise<LeaderDashboard> {
  const teamRows = await scopedTeams(executor, actor);
  const members = await scopedMembers(executor, teamRows);
  // Ekipsiz değerlendiriciler (loca süpervizörü, ekipsiz etkinlikte kısım sorumlusu) de etkinlik sayar:
  // etkinlikler ekiplerin ve değerlendirilebilir etkinliklerin birleşimidir.
  const reviewable = await listReviewableEvents(executor, actor);
  const refs = unionRefs(eventRefs(teamRows), reviewable);
  const upcoming = refs.filter((e) => isUpcoming(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    teamCount: teamRows.length,
    memberCount: new Set(members.map((m) => m.staffId)).size,
    eventCount: refs.length,
    upcoming: upcoming.slice(0, 5),
    next: upcoming[0] ?? null,
    countdown: upcoming[0] ? countdownParts(new Date(upcoming[0].startsAt), now) : null,
    pendingReviewEvents: reviewable.filter((e) => e.reviewEnabled && e.completedCount < e.memberCount).length,
  };
}

export type LeaderEventFilter = { search?: string; status?: string };

/** Atanmış etkinlikler; ad ve durum süzgeci bellekte uygulanır (liste küçüktür). */
export async function listLeaderEvents(
  executor: Executor,
  actor: Actor,
  filter: LeaderEventFilter = {},
): Promise<ReviewableEvent[]> {
  const all = await listReviewableEvents(executor, actor);
  const search = filter.search?.trim().toLocaleLowerCase("tr-TR");
  return all.filter(
    (e) =>
      (!filter.status || e.status === filter.status) && (!search || e.name.toLocaleLowerCase("tr-TR").includes(search)),
  );
}

export type LeaderEventTeam = {
  id: string;
  name: string;
  color: string;
  members: Array<{ staffId: string; fullName: string; color: string | null; tableIds: string[] }>;
  tableIds: string[];
};

export type LeaderEventDetail = {
  event: LeaderEventRef;
  teams: LeaderEventTeam[];
  memberCount: number;
  assignedTableIds: string[];
  tableLabels: Record<string, string>;
  guestCount: number;
  plan: FloorPlanData;
};

/** Ekibin masaları: ekibe bağlı masa grupları ile üyelerin bu etkinlikteki atamalarının birleşimi. */
async function loadTableLinks(executor: Executor, eventId: string, teamRows: ScopedTeam[], staffIds: string[]) {
  const teamIds = teamRows.map((t) => t.id);
  const memberIds = [...new Set(staffIds)];
  const groupRows =
    teamIds.length === 0
      ? []
      : await executor
          .select({ teamId: tableGroups.teamId, tableId: tableGroupTables.tableId })
          .from(tableGroups)
          .innerJoin(tableGroupTables, eq(tableGroupTables.tableGroupId, tableGroups.id))
          .where(and(eq(tableGroups.eventId, eventId), inArray(tableGroups.teamId, teamIds)));
  const assignmentRows =
    memberIds.length === 0
      ? []
      : await executor
          .select({ staffId: eventStaffAssignments.staffId, tableId: assignmentTables.tableId })
          .from(eventStaffAssignments)
          .innerJoin(assignmentTables, eq(assignmentTables.assignmentId, eventStaffAssignments.id))
          .where(and(eq(eventStaffAssignments.eventId, eventId), inArray(eventStaffAssignments.staffId, memberIds)));
  return { groupRows, assignmentRows };
}

/**
 * Atanan etkinlik ayrıntısı. Aktörün etkinlikte değerlendirebildiği kimse yoksa `not_found`
 * (lider başkasının etkinliğini göremez; var olup olmadığı da sızmaz). Hiçbir ekipte olmayan
 * değerlendirilebilir personel (ör. loca süpervizörünün personeli) "Ekip dışı personel" altında gelir.
 */
export async function getLeaderEventDetail(
  executor: Executor,
  actor: Actor,
  eventId: string,
): Promise<LeaderEventDetail> {
  const teamRows = (await scopedTeams(executor, actor)).filter((t) => t.eventId === eventId);
  const reviewable = await reviewableStaff(executor, actor, eventId);
  if (reviewable.size === 0) throw new DomainError("not_found", NOT_FOUND_EVENT);
  const [event] = await executor
    .select({ name: events.name, startsAt: events.startsAt, status: events.status })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) throw new DomainError("not_found", NOT_FOUND_EVENT);

  const members = await scopedMembers(executor, teamRows);
  const inTeams = new Set(members.map((m) => m.staffId));
  const outsideIds = [...reviewable.keys()].filter((id) => !inTeams.has(id));
  const outsidePeople =
    outsideIds.length === 0
      ? []
      : await executor
          .select({ staffId: staff.id, fullName: staff.fullName, color: staff.color })
          .from(staff)
          .where(inArray(staff.id, outsideIds))
          .orderBy(asc(staff.fullName));
  const { groupRows, assignmentRows } = await loadTableLinks(executor, eventId, teamRows, [...inTeams, ...outsideIds]);

  const tablesOfStaff = (staffId: string) => [
    ...new Set(assignmentRows.filter((a) => a.staffId === staffId).map((a) => a.tableId)),
  ];
  const teamsView: LeaderEventTeam[] = teamRows.map((t) => {
    const teamMembers = members.filter((m) => m.teamId === t.id);
    const groupTables = groupRows.filter((g) => g.teamId === t.id).map((g) => g.tableId);
    const memberTables = teamMembers.flatMap((m) => tablesOfStaff(m.staffId));
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      members: teamMembers.map((m) => ({
        staffId: m.staffId,
        fullName: m.fullName,
        color: m.color,
        tableIds: tablesOfStaff(m.staffId),
      })),
      tableIds: [...new Set([...groupTables, ...memberTables])],
    };
  });
  if (outsidePeople.length > 0) {
    const outsideMembers = outsidePeople.map((p) => ({ ...p, tableIds: tablesOfStaff(p.staffId) }));
    teamsView.push({
      ...OUTSIDE_TEAM,
      members: outsideMembers,
      tableIds: [...new Set(outsideMembers.flatMap((m) => m.tableIds))],
    });
  }
  const assignedTableIds = [...new Set(teamsView.flatMap((t) => t.tableIds))];

  const labelRows =
    assignedTableIds.length === 0
      ? []
      : await executor
          .select({ id: eventTables.id, label: eventTables.label })
          .from(eventTables)
          .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, assignedTableIds)));
  const guestRows =
    assignedTableIds.length === 0
      ? []
      : await executor
          .select({ guestCount: reservations.guestCount })
          .from(reservations)
          .where(
            and(
              eq(reservations.eventId, eventId),
              inArray(reservations.tableId, assignedTableIds),
              inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
            ),
          );
  const plan = await getFloorPlan(executor, actor, eventId);

  return {
    event: { id: eventId, name: event.name, startsAt: event.startsAt.toISOString(), status: event.status },
    teams: teamsView,
    memberCount: inTeams.size + outsidePeople.length,
    assignedTableIds,
    tableLabels: Object.fromEntries(labelRows.map((r) => [r.id, r.label])),
    guestCount: guestRows.reduce((sum, r) => sum + r.guestCount, 0),
    plan: { canvas: plan.canvas, tables: plan.tables, decor: plan.decor },
  };
}

export type LeaderTeamCard = {
  id: string;
  name: string;
  color: string;
  eventId: string | null;
  eventName: string | null;
  eventStartsAt: string | null;
  members: Array<{ staffId: string; fullName: string; sicilNo: string; color: string | null; role: string | null }>;
};

/** "Takımlarım": aktörün kapsamındaki ekipler ve üyeleri. */
export async function listLeaderTeams(executor: Executor, actor: Actor): Promise<LeaderTeamCard[]> {
  const teamRows = await scopedTeams(executor, actor);
  const members = await scopedMembers(executor, teamRows);
  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    eventId: t.eventId,
    eventName: t.eventName,
    eventStartsAt: t.eventStartsAt ? t.eventStartsAt.toISOString() : null,
    members: members
      .filter((m) => m.teamId === t.id)
      .map((m) => ({ staffId: m.staffId, fullName: m.fullName, sicilNo: m.sicilNo, color: m.color, role: m.role })),
  }));
}

export type MemberReviewEntry = {
  eventId: string;
  eventName: string;
  score: number;
  band: RatingBand;
  completedAt: string;
};

export type MemberPerformance = {
  staffId: string;
  fullName: string;
  sicilNo: string;
  teams: Array<{ id: string; name: string; eventName: string | null }>;
  reviewCount: number;
  averageScore: number | null;
  averageBand: RatingBand | null;
  trend: Trend | null;
  categories: Record<RatingKey, number | null>;
  history: MemberReviewEntry[];
};

/** Aktörün kendi tamamladığı değerlendirmeler (özel notlar dahil değil), eskiden yeniye. */
async function completedReviewsBy(executor: Executor, actor: Actor, staffIds: string[]) {
  if (staffIds.length === 0) return [];
  return executor
    .select({
      staffId: staffPerformanceReviews.staffId,
      eventId: staffPerformanceReviews.eventId,
      eventName: events.name,
      score: staffPerformanceReviews.score,
      updatedAt: staffPerformanceReviews.updatedAt,
      communication: staffPerformanceReviews.communication,
      punctuality: staffPerformanceReviews.punctuality,
      teamwork: staffPerformanceReviews.teamwork,
      customerService: staffPerformanceReviews.customerService,
      technicalSkills: staffPerformanceReviews.technicalSkills,
      initiative: staffPerformanceReviews.initiative,
      appearance: staffPerformanceReviews.appearance,
      stressManagement: staffPerformanceReviews.stressManagement,
    })
    .from(staffPerformanceReviews)
    .innerJoin(events, eq(events.id, staffPerformanceReviews.eventId))
    .where(
      and(
        eq(staffPerformanceReviews.reviewerId, actor.id),
        eq(staffPerformanceReviews.isCompleted, true),
        inArray(staffPerformanceReviews.staffId, staffIds),
      ),
    )
    .orderBy(asc(staffPerformanceReviews.updatedAt));
}

type ReviewRatings = Record<RatingKey, number | null>;

function ratingsOf(row: ReviewRatings): ReviewRatings {
  return Object.fromEntries(RATING_KEYS.map((k) => [k, row[k]])) as ReviewRatings;
}

async function isReviewableAnywhere(executor: Executor, actor: Actor, staffId: string): Promise<boolean> {
  const eventIds = await reviewEventIds(executor, actor);
  if (eventIds.length === 0) return false;
  const byEvent = await reviewableByEvent(executor, actor, eventIds);
  return [...byEvent.values()].some((map) => map.has(staffId));
}

/** Ekip üyesinin performans analizi. Üye aktörün ekiplerinde ve değerlendirilebilir kümesinde değilse `not_found`. */
export async function getMemberPerformance(
  executor: Executor,
  actor: Actor,
  staffId: string,
): Promise<MemberPerformance> {
  const teamRows = await scopedTeams(executor, actor);
  const memberships = (await scopedMembers(executor, teamRows)).filter((m) => m.staffId === staffId);
  // Ekipsiz ama herhangi bir etkinlikte değerlendirilebilen personel de açılır (ekip listesi boş kalır).
  if (memberships.length === 0 && !(await isReviewableAnywhere(executor, actor, staffId))) {
    throw new DomainError("not_found", NOT_FOUND_MEMBER);
  }
  const [person] = await executor
    .select({ fullName: staff.fullName, sicilNo: staff.sicilNo })
    .from(staff)
    .where(eq(staff.id, staffId));
  if (!person) throw new DomainError("not_found", NOT_FOUND_MEMBER);

  const reviews = await completedReviewsBy(executor, actor, [staffId]);
  const scores = reviews.map((r) => r.score);
  const averageScore = average(scores);
  return {
    staffId,
    fullName: person.fullName,
    sicilNo: person.sicilNo,
    teams: memberships.flatMap((m) => {
      const team = teamRows.find((t) => t.id === m.teamId);
      return team ? [{ id: team.id, name: team.name, eventName: team.eventName }] : [];
    }),
    reviewCount: reviews.length,
    averageScore,
    averageBand: averageScore === null ? null : ratingBand(averageScore),
    trend: trendOf(scores),
    categories: categoryAverages(reviews.map(ratingsOf)),
    history: reviews
      .map((r) => ({
        eventId: r.eventId,
        eventName: r.eventName,
        score: r.score,
        band: ratingBand(r.score),
        completedAt: r.updatedAt.toISOString(),
      }))
      .reverse(),
  };
}

export type LeaderReportRow = {
  teamId: string;
  teamName: string;
  eventName: string | null;
  memberCount: number;
  reviewedCount: number;
  averageScore: number | null;
};

export type LeaderReport = {
  teamCount: number;
  memberCount: number;
  upcomingEventCount: number;
  eventCount: number;
  reviewCount: number;
  averageScore: number | null;
  trend: Trend | null;
  rows: LeaderReportRow[];
};

/** Raporlar: ekip bazında üye/değerlendirme özeti ve genel ortalama. */
export async function getLeaderReport(
  executor: Executor,
  actor: Actor,
  now: Date = new Date(),
): Promise<LeaderReport> {
  const teamRows = await scopedTeams(executor, actor);
  const members = await scopedMembers(executor, teamRows);
  const refs = eventRefs(teamRows);
  const reviews = await completedReviewsBy(executor, actor, [...new Set(members.map((m) => m.staffId))]);

  const rows = teamRows.map((team): LeaderReportRow => {
    const teamMembers = members.filter((m) => m.teamId === team.id);
    const ids = new Set(teamMembers.map((m) => m.staffId));
    // Değerlendirme etkinliğe bağlıdır: yalnızca ekibin etkinliğindekiler sayılır.
    const mine = reviews.filter((r) => ids.has(r.staffId) && (team.eventId === null || r.eventId === team.eventId));
    return {
      teamId: team.id,
      teamName: team.name,
      eventName: team.eventName,
      memberCount: teamMembers.length,
      reviewedCount: new Set(mine.map((r) => r.staffId)).size,
      averageScore: average(mine.map((r) => r.score)),
    };
  });
  const scores = reviews.map((r) => r.score);
  return {
    teamCount: teamRows.length,
    memberCount: new Set(members.map((m) => m.staffId)).size,
    eventCount: refs.length,
    upcomingEventCount: refs.filter((e) => isUpcoming(e, now)).length,
    reviewCount: reviews.length,
    averageScore: average(scores),
    trend: trendOf(scores),
    rows,
  };
}
