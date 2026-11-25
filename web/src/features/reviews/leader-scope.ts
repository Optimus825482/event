import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, teamMembers, teams } from "@/db/schema";
import { can, type PolicyActor } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { reviewEventIds, reviewableStaff, type ReviewBasis } from "./authority";
import { authorizeReviewsGate } from "./service";

type Executor = Db | Tx;

export type ScopedTeam = {
  id: string;
  name: string;
  color: string;
  leaderStaffId: string | null;
  eventId: string | null;
  eventName: string | null;
  eventStartsAt: Date | null;
  eventStatus: string | null;
};

export type ScopedMember = {
  teamId: string;
  staffId: string;
  fullName: string;
  sicilNo: string;
  color: string | null;
  role: string | null;
  isLeader: boolean;
};

/** Lider paneli sayfalarını açabilir mi? (Hiyerarşi aktörü için bağlı personel kaydı gerekir.) */
export function canUseLeaderPanel(actor: PolicyActor): boolean {
  return can(actor, "reviews", "view", actor.staffId ? { reviewerStaffIds: [actor.staffId] } : undefined);
}

/**
 * Aktörün verilen etkinliklerde değerlendirebildiği personel (etkinlik → personel → dayanaklar).
 * Etkinlik başına `reviewableStaff` çağrılır (her biri en fazla 6 sorgu); tek yerde toplanmıştır ki
 * toplu bir yetki çekirdeği işlevine geçiş yalnızca burayı değiştirsin.
 */
export async function reviewableByEvent(
  executor: Executor,
  actor: PolicyActor,
  eventIds: readonly string[],
): Promise<Map<string, Map<string, ReviewBasis[]>>> {
  const result = new Map<string, Map<string, ReviewBasis[]>>();
  for (const eventId of eventIds) result.set(eventId, await reviewableStaff(executor, actor, eventId));
  return result;
}

/**
 * `scopedTeams`'in ürettiği her ekip nesnesi için, ekibin etkinliğinde aktörün değerlendirebildiği personel.
 * `scopedMembers` yalnızca bu kayda bakar: `scopedTeams`'ten gelmeyen ekip hiçbir üye açmaz (kapalı başarısızlık).
 */
const reviewableOfTeam = new WeakMap<ScopedTeam, ReadonlySet<string>>();

/**
 * Aktörün değerlendirebildiği en az bir personeli (üye ya da lider) içeren etkin ekipler, tüm etkinliklerde.
 * Kapsam değerlendirme hiyerarşisinden hesaplanır (bkz. features/reviews/authority.ts).
 */
export async function scopedTeams(executor: Executor, actor: Actor): Promise<ScopedTeam[]> {
  authorizeReviewsGate(actor, "view");
  const eventIds = await reviewEventIds(executor, actor);
  if (eventIds.length === 0) return [];
  const reviewable = await reviewableByEvent(executor, actor, eventIds);
  const rows = await executor
    .select({
      id: teams.id,
      name: teams.name,
      color: teams.color,
      leaderStaffId: teams.leaderStaffId,
      eventId: teams.eventId,
      eventName: events.name,
      eventStartsAt: events.startsAt,
      eventStatus: events.status,
    })
    .from(teams)
    .innerJoin(events, eq(events.id, teams.eventId))
    .where(and(eq(teams.isActive, true), inArray(teams.eventId, eventIds)))
    .orderBy(asc(events.startsAt), asc(teams.sortOrder), asc(teams.name));
  if (rows.length === 0) return [];
  const memberRows = await executor
    .select({ teamId: teamMembers.teamId, staffId: teamMembers.staffId })
    .from(teamMembers)
    .where(
      inArray(
        teamMembers.teamId,
        rows.map((r) => r.id),
      ),
    );

  const result: ScopedTeam[] = [];
  for (const r of rows) {
    const set = r.eventId ? reviewable.get(r.eventId) : undefined;
    if (!set) continue;
    const people = memberRows.filter((m) => m.teamId === r.id).map((m) => m.staffId);
    if (r.leaderStaffId) people.push(r.leaderStaffId);
    if (!people.some((id) => set.has(id))) continue;
    const team: ScopedTeam = {
      id: r.id,
      name: r.name,
      color: r.color,
      leaderStaffId: r.leaderStaffId,
      eventId: r.eventId,
      eventName: r.eventName,
      eventStartsAt: r.eventStartsAt,
      eventStatus: r.eventStatus,
    };
    reviewableOfTeam.set(team, new Set(set.keys()));
    result.push(team);
  }
  return result;
}

/**
 * Ekiplerin aktörün değerlendirebildiği üyeleri; ekibin lideri değerlendirilebilirse (ör. süpervizör için
 * kaptan) ekip üyesi kaydı olmasa da `isLeader` ile listelenir. Aktör kendini hiçbir zaman görmez.
 */
export async function scopedMembers(executor: Executor, scoped: ScopedTeam[]): Promise<ScopedMember[]> {
  const known = scoped.filter((t) => reviewableOfTeam.has(t));
  if (known.length === 0) return [];
  const teamIds = known.map((t) => t.id);
  const rows = await executor
    .select({
      teamId: teamMembers.teamId,
      staffId: staff.id,
      fullName: staff.fullName,
      sicilNo: staff.sicilNo,
      color: staff.color,
      role: teamMembers.role,
      isLeader: teamMembers.isLeader,
    })
    .from(teamMembers)
    .innerJoin(staff, eq(staff.id, teamMembers.staffId))
    .where(inArray(teamMembers.teamId, teamIds));
  const leaderIds = [...new Set(known.flatMap((t) => (t.leaderStaffId ? [t.leaderStaffId] : [])))];
  const leaders =
    leaderIds.length === 0
      ? []
      : await executor
          .select({ staffId: staff.id, fullName: staff.fullName, sicilNo: staff.sicilNo, color: staff.color })
          .from(staff)
          .where(inArray(staff.id, leaderIds));

  const out: ScopedMember[] = [];
  for (const team of known) {
    const allowed = reviewableOfTeam.get(team);
    if (!allowed) continue;
    const own = rows.filter((r) => r.teamId === team.id && allowed.has(r.staffId));
    out.push(...own);
    const leader = team.leaderStaffId ? leaders.find((l) => l.staffId === team.leaderStaffId) : undefined;
    if (leader && allowed.has(leader.staffId) && !own.some((r) => r.staffId === leader.staffId)) {
      out.push({ teamId: team.id, ...leader, role: null, isLeader: true });
    }
  }
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
}
