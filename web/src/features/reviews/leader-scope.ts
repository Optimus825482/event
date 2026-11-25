import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, teamMembers, teams } from "@/db/schema";
import { can, type PolicyActor } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { authorizeReviewsGate } from "./service";
import { ownTeamOnly, seesOnlyOwnEvents } from "@/features/auth/scope";

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

/** Lider paneli sayfalarını açabilir mi? (Lider için bağlı personel kaydı gerekir.) */
export function canUseLeaderPanel(actor: PolicyActor): boolean {
  return can(actor, "reviews", "view", actor.staffId ? { teamLeaderStaffId: actor.staffId } : undefined);
}

/**
 * Aktörün görebildiği ekipler. Lider yalnızca kendi ekibini (lideri olduğu) görür; organizatör
 * yalnızca kendi etkinliklerinin ekiplerini; yönetici tümünü. Başkasının ekibi buraya hiç girmez.
 */
export async function scopedTeams(executor: Executor, actor: Actor): Promise<ScopedTeam[]> {
  authorizeReviewsGate(actor, "view");
  const conditions = [eq(teams.isActive, true)];
  if (ownTeamOnly(actor)) {
    if (!actor.staffId) return [];
    conditions.push(eq(teams.leaderStaffId, actor.staffId));
  }
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
      organizerId: events.organizerId,
    })
    .from(teams)
    .leftJoin(events, eq(events.id, teams.eventId))
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(teams.sortOrder), asc(teams.name));
  return rows
    .filter((r) => (seesOnlyOwnEvents(actor) ? r.organizerId === actor.id : true))
    .filter((r) => r.organizerId === null || canAccessEvent(actor, { organizerId: r.organizerId }))
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      leaderStaffId: r.leaderStaffId,
      eventId: r.eventId,
      eventName: r.eventName,
      eventStartsAt: r.eventStartsAt,
      eventStatus: r.eventStatus,
    }));
}

/** Ekiplerin üyeleri; lider kendini değerlendirmediği için kendi ekibinde üye sayılmaz. */
export async function scopedMembers(executor: Executor, scoped: ScopedTeam[]): Promise<ScopedMember[]> {
  if (scoped.length === 0) return [];
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
    .where(
      inArray(
        teamMembers.teamId,
        scoped.map((t) => t.id),
      ),
    )
    .orderBy(asc(staff.fullName));
  const leaderOf = new Map(scoped.map((t) => [t.id, t.leaderStaffId]));
  return rows.filter((r) => leaderOf.get(r.teamId) !== r.staffId);
}
