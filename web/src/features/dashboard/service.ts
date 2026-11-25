import { and, asc, count, eq, gte, inArray, notInArray, or, sql, type SQLWrapper } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  eventStaffAssignments,
  eventTables,
  events,
  organizationTemplates,
  reservations,
  staff,
  systemSettings,
  teams,
  users,
  venueTemplates,
} from "@/db/schema";
import { authorize, can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { isAdmin } from "@/features/auth/scope";

type Executor = Db | Tx;

const UPCOMING_LIMIT = 5;
const TZ = "Europe/Istanbul";

export type UpcomingReadyEvent = {
  id: string;
  name: string;
  startsAt: Date;
  hasVenueLayout: boolean;
  hasTeamAssignment: boolean;
};

export type EventsDashboard = {
  totalEvents: number;
  completedEvents: number;
  upcomingEvents: number;
  draftEvents: number;
  totalStaff: number;
  totalTeams: number;
  venueTemplates: number;
  organizationTemplates: number;
  upcoming: UpcomingReadyEvent[];
};

export type AdminDashboard = {
  users: { total: number; active: number; admins: number; newThisMonth: number };
  events: { total: number; upcoming: number; thisMonth: number; today: number };
  reservations: { total: number; today: number };
  teams: { total: number; active: number };
  settings: { smtpConfigured: boolean; emailNotifications: boolean };
};

// Tamamlanan: durumu "completed" ya da başlangıcı geçmiş (iptaller hariç). Yaklaşan: başlangıcı gelecekte ve bitmemiş.
const OPEN_STATUSES = ["draft", "published", "active"] as const;

export async function getEventsDashboard(db: Executor, actor: Actor): Promise<EventsDashboard> {
  authorize(actor, "events", "view");

  const [stats] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${events.status} = 'completed' or (${events.startsAt} < now() and ${events.status} <> 'cancelled'))::int`,
      upcoming: sql<number>`count(*) filter (where ${events.startsAt} >= now() and ${events.status} in ('draft','published','active'))::int`,
      draft: sql<number>`count(*) filter (where ${events.status} = 'draft')::int`,
    })
    .from(events);

  const hasTables = sql<boolean>`exists (select 1 from ${eventTables} where ${eventTables.eventId} = ${events.id})`;
  const hasTeam = sql<boolean>`exists (select 1 from ${eventStaffAssignments} where ${eventStaffAssignments.eventId} = ${events.id})`;
  const upcoming = await db
    .select({ id: events.id, name: events.name, startsAt: events.startsAt, hasVenueLayout: hasTables, hasTeamAssignment: hasTeam })
    .from(events)
    .where(and(gte(events.startsAt, sql`now()`), inArray(events.status, [...OPEN_STATUSES]), hasTables, hasTeam))
    .orderBy(asc(events.startsAt))
    .limit(UPCOMING_LIMIT);

  // Sayılar yalnızca ilgili modülü görebilenlere verilir; şablonlarda görünürlük kuralı (herkese açık ya da kendi) uygulanır.
  const seeStaff = can(actor, "staff", "view");
  const seeVenues = can(actor, "venues", "view");
  const templateScope = isAdmin(actor) ? undefined : or(eq(venueTemplates.isPublic, true), eq(venueTemplates.createdById, actor.id));
  const none = [{ n: 0 }];
  const [staffRow] = seeStaff ? await db.select({ n: count() }).from(staff).where(eq(staff.status, "active")) : none;
  const [teamRow] = seeStaff ? await db.select({ n: count() }).from(teams).where(eq(teams.isActive, true)) : none;
  const [venueRow] = seeVenues ? await db.select({ n: count() }).from(venueTemplates).where(templateScope) : none;
  const [orgRow] = seeStaff
    ? await db.select({ n: count() }).from(organizationTemplates).where(eq(organizationTemplates.isActive, true))
    : none;

  return {
    totalEvents: stats?.total ?? 0,
    completedEvents: stats?.completed ?? 0,
    upcomingEvents: stats?.upcoming ?? 0,
    draftEvents: stats?.draft ?? 0,
    totalStaff: staffRow?.n ?? 0,
    totalTeams: teamRow?.n ?? 0,
    venueTemplates: venueRow?.n ?? 0,
    organizationTemplates: orgRow?.n ?? 0,
    upcoming,
  };
}

/** Yalnızca yönetici: kullanıcı ve ayar görüntüleme yetkisi ikisi birden gerekir. */
export async function getAdminDashboard(db: Executor, actor: Actor): Promise<AdminDashboard> {
  authorize(actor, "users", "view");
  authorize(actor, "settings", "view");

  const monthStart = sql`date_trunc('month', now() at time zone ${TZ})`;
  const dayStart = sql`date_trunc('day', now() at time zone ${TZ})`;
  const local = (column: SQLWrapper) => sql`(${column} at time zone ${TZ})`;

  const [userRow] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${users.isActive})::int`,
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
      newThisMonth: sql<number>`count(*) filter (where ${local(users.createdAt)} >= ${monthStart})::int`,
    })
    .from(users);

  const [eventRow] = await db
    .select({
      total: count(),
      upcoming: sql<number>`count(*) filter (where ${events.startsAt} >= now() and ${events.status} in ('draft','published','active'))::int`,
      thisMonth: sql<number>`count(*) filter (where ${local(events.startsAt)} >= ${monthStart} and ${local(events.startsAt)} < ${monthStart} + interval '1 month')::int`,
      today: sql<number>`count(*) filter (where ${local(events.createdAt)} >= ${dayStart})::int`,
    })
    .from(events);

  const [resRow] = await db
    .select({
      total: count(),
      today: sql<number>`count(*) filter (where ${local(reservations.createdAt)} >= ${dayStart})::int`,
    })
    .from(reservations)
    .where(notInArray(reservations.status, ["cancelled"]));

  const [teamRow] = await db
    .select({ total: count(), active: sql<number>`count(*) filter (where ${teams.isActive})::int` })
    .from(teams);

  const [settingsRow] = await db
    .select({ smtpHost: systemSettings.smtpHost, emailNotifications: systemSettings.emailNotifications })
    .from(systemSettings)
    .limit(1);

  return {
    users: {
      total: userRow?.total ?? 0,
      active: userRow?.active ?? 0,
      admins: userRow?.admins ?? 0,
      newThisMonth: userRow?.newThisMonth ?? 0,
    },
    events: {
      total: eventRow?.total ?? 0,
      upcoming: eventRow?.upcoming ?? 0,
      thisMonth: eventRow?.thisMonth ?? 0,
      today: eventRow?.today ?? 0,
    },
    reservations: { total: resRow?.total ?? 0, today: resRow?.today ?? 0 },
    teams: { total: teamRow?.total ?? 0, active: teamRow?.active ?? 0 },
    settings: {
      smtpConfigured: Boolean(settingsRow?.smtpHost),
      emailNotifications: settingsRow?.emailNotifications ?? false,
    },
  };
}
