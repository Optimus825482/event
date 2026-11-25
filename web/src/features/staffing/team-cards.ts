import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventStaffAssignments, events, staff, teamMembers, teams } from "@/db/schema";
import { authorize, type PolicyActor } from "@/features/auth/policy";
import { seesOnlyOwnEvents } from "@/features/auth/scope";

export type TeamCard = {
  id: string;
  name: string;
  color: string;
  leaderName: string | null;
  memberCount: number;
  assignmentCount: number;
  eventId: string | null;
  eventName: string | null;
  eventStartsAt: string | null;
  eventStatus: string | null;
};

/**
 * Personel sayfasındaki "Ekipler" sekmesi: tüm etkin ekipler, lideri, üye sayısı ve bağlı olduğu
 * etkinlik. Organizatör yalnızca kendi etkinliklerinin ekiplerini görür (genel ekipler yöneticiye özgüdür).
 */
export async function listTeamCards(db: Db | Tx, actor: PolicyActor): Promise<TeamCard[]> {
  authorize(actor, "staff", "view");
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      color: teams.color,
      leaderName: staff.fullName,
      eventId: teams.eventId,
      eventName: events.name,
      eventStartsAt: events.startsAt,
      eventStatus: events.status,
      organizerId: events.organizerId,
    })
    .from(teams)
    .leftJoin(staff, eq(staff.id, teams.leaderStaffId))
    .leftJoin(events, eq(events.id, teams.eventId))
    .where(eq(teams.isActive, true))
    .orderBy(desc(events.startsAt), asc(teams.sortOrder), asc(teams.name));
  const visible = rows.filter((r) => !seesOnlyOwnEvents(actor) || r.organizerId === actor.id);
  if (visible.length === 0) return [];

  const ids = visible.map((r) => r.id);
  const members = await db
    .select({ teamId: teamMembers.teamId, total: count() })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, ids))
    .groupBy(teamMembers.teamId);
  const assignments = await db
    .select({ teamId: eventStaffAssignments.teamId, total: count() })
    .from(eventStaffAssignments)
    .where(and(inArray(eventStaffAssignments.teamId, ids), eq(eventStaffAssignments.isActive, true)))
    .groupBy(eventStaffAssignments.teamId);
  const memberCount = new Map(members.map((m) => [m.teamId, m.total]));
  const assignmentCount = new Map(assignments.map((a) => [a.teamId, a.total]));

  return visible.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    leaderName: r.leaderName,
    memberCount: memberCount.get(r.id) ?? 0,
    assignmentCount: assignmentCount.get(r.id) ?? 0,
    eventId: r.eventId,
    eventName: r.eventName,
    eventStartsAt: r.eventStartsAt ? r.eventStartsAt.toISOString() : null,
    eventStatus: r.eventStatus,
  }));
}
