import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventSectionHeads,
  eventStaffAssignments,
  events,
  tableGroups,
  tableGroupTables,
  teamMembers,
  teams,
} from "@/db/schema";
import { authorize, can, type PolicyActor, type Verb } from "@/features/auth/policy";
import { isAdmin, ownTeamOnly } from "@/features/auth/scope";
import { DomainError } from "@/lib/action";
import { REVIEW_MESSAGES } from "./labels";

type Executor = Db | Tx;

/**
 * Değerlendirme dayanağı: R, X'i E etkinliğinde neden değerlendirebilir.
 * - `captain`: R, E'deki etkin bir ekibin lideri; X o ekibin üyesi.
 * - `supervisor`: R, E'deki bir masa grubunun süpervizörü; X grubun (etkin) ekibinin üyesi ya da lideri,
 *   ya da grubun bir masasına atanmış personel.
 * - `section_head`: R, E'nin kısım sorumlusu; X E'deki herhangi bir personel.
 * - `manager`: F&B yöneticisi/asistanı ya da admin; X E'deki herhangi bir personel.
 * Kendi kendini değerlendirme hiçbir dayanakta yoktur.
 */
export type ReviewBasis = "captain" | "supervisor" | "section_head" | "manager";

export const REVIEW_BASIS_LABELS: Record<ReviewBasis, string> = {
  captain: "Kaptan",
  supervisor: "Şef / Süpervizör",
  section_head: "Kısım Sorumlusu",
  manager: "F&B Yönetimi",
};

type HierarchyTeam = { leaderStaffId: string | null; memberIds: string[] };
type HierarchyGroup = { supervisorStaffId: string; team: HierarchyTeam | null; tableStaffIds: string[] };

/** Bir etkinliğin değerlendirme hiyerarşisi: yalnızca etkin, etkinliğe ait ekipler ve etkin atamalar. */
type EventHierarchy = {
  teams: HierarchyTeam[];
  groups: HierarchyGroup[];
  sectionHeadIds: string[];
  assignedStaffIds: string[];
};

async function loadHierarchy(ex: Executor, eventId: string): Promise<EventHierarchy> {
  const teamRows = await ex
    .select({ id: teams.id, leaderStaffId: teams.leaderStaffId })
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.isActive, true)));
  const memberRows =
    teamRows.length === 0
      ? []
      : await ex
          .select({ teamId: teamMembers.teamId, staffId: teamMembers.staffId })
          .from(teamMembers)
          .where(
            inArray(
              teamMembers.teamId,
              teamRows.map((t) => t.id),
            ),
          );
  const teamById = new Map<string, HierarchyTeam>(
    teamRows.map((t) => [t.id, { leaderStaffId: t.leaderStaffId, memberIds: [] }]),
  );
  for (const m of memberRows) teamById.get(m.teamId)?.memberIds.push(m.staffId);

  const groupRows = await ex
    .select({ id: tableGroups.id, teamId: tableGroups.teamId, supervisorStaffId: tableGroups.supervisorStaffId })
    .from(tableGroups)
    .where(and(eq(tableGroups.eventId, eventId), isNotNull(tableGroups.supervisorStaffId)));
  const tableStaffRows =
    groupRows.length === 0
      ? []
      : await ex
          .select({ groupId: tableGroupTables.tableGroupId, staffId: eventStaffAssignments.staffId })
          .from(tableGroupTables)
          .innerJoin(
            assignmentTables,
            and(eq(assignmentTables.eventId, tableGroupTables.eventId), eq(assignmentTables.tableId, tableGroupTables.tableId)),
          )
          .innerJoin(
            eventStaffAssignments,
            and(
              eq(eventStaffAssignments.eventId, assignmentTables.eventId),
              eq(eventStaffAssignments.id, assignmentTables.assignmentId),
            ),
          )
          .where(and(eq(tableGroupTables.eventId, eventId), eq(eventStaffAssignments.isActive, true)));
  const groups: HierarchyGroup[] = groupRows.map((g) => ({
    // Sorguda NULL süpervizörler elendi.
    supervisorStaffId: g.supervisorStaffId as string,
    // Pasif ya da başka etkinliğin ekibi dayanak üretmez.
    team: g.teamId ? (teamById.get(g.teamId) ?? null) : null,
    tableStaffIds: tableStaffRows.filter((r) => r.groupId === g.id).map((r) => r.staffId),
  }));

  const headRows = await ex
    .select({ staffId: eventSectionHeads.staffId })
    .from(eventSectionHeads)
    .where(eq(eventSectionHeads.eventId, eventId));
  const assignmentRows = await ex
    .select({ staffId: eventStaffAssignments.staffId })
    .from(eventStaffAssignments)
    .where(and(eq(eventStaffAssignments.eventId, eventId), eq(eventStaffAssignments.isActive, true)));

  return {
    teams: [...teamById.values()],
    groups,
    sectionHeadIds: headRows.map((r) => r.staffId),
    assignedStaffIds: assignmentRows.map((r) => r.staffId),
  };
}

function staffOf(h: EventHierarchy): Set<string> {
  const ids = new Set<string>();
  for (const t of h.teams) {
    if (t.leaderStaffId) ids.add(t.leaderStaffId);
    for (const m of t.memberIds) ids.add(m);
  }
  for (const g of h.groups) ids.add(g.supervisorStaffId);
  for (const id of h.assignedStaffIds) ids.add(id);
  for (const id of h.sectionHeadIds) ids.add(id);
  return ids;
}

/** Süpervizör dayanağının kapsadığı personel: grubun ekibi (üyeler + lider) ve masalarına atananlar. */
function groupScope(g: HierarchyGroup): string[] {
  const ids = [...g.tableStaffIds];
  if (g.team) {
    ids.push(...g.team.memberIds);
    if (g.team.leaderStaffId) ids.push(g.team.leaderStaffId);
  }
  return ids;
}

/** R'nin dayanaklarıyla değerlendirebildiği personel; dayanak sırası captain, supervisor, section_head. */
function reviewableBy(h: EventHierarchy, reviewerId: string): Map<string, ReviewBasis[]> {
  const found: Record<Exclude<ReviewBasis, "manager">, Set<string>> = {
    captain: new Set(),
    supervisor: new Set(),
    section_head: new Set(),
  };
  for (const t of h.teams) {
    if (t.leaderStaffId === reviewerId) for (const m of t.memberIds) found.captain.add(m);
  }
  for (const g of h.groups) {
    if (g.supervisorStaffId === reviewerId) for (const id of groupScope(g)) found.supervisor.add(id);
  }
  if (h.sectionHeadIds.includes(reviewerId)) for (const id of staffOf(h)) found.section_head.add(id);

  const map = new Map<string, ReviewBasis[]>();
  for (const basis of ["captain", "supervisor", "section_head"] as const) {
    for (const id of found[basis]) {
      if (id === reviewerId) continue;
      const list = map.get(id);
      if (list) list.push(basis);
      else map.set(id, [basis]);
    }
  }
  return map;
}

/** Etkinliğin tüm dayanaklarını açan aktör: admin ya da F&B yöneticisi/asistanı (değerlendirme izniyle). */
function seesWholeEvent(actor: PolicyActor): boolean {
  return isAdmin(actor) || (!ownTeamOnly(actor) && can(actor, "reviews", "view"));
}

/** Hiyerarşiyle değerlendirme yapabilecek aktör: personel kaydı olan ve modül izni taşıyan kullanıcı. */
function hierarchyReviewerId(actor: PolicyActor): string | null {
  if (actor.staffId === null) return null;
  return can(actor, "reviews", "view", { reviewerStaffIds: [actor.staffId] }) ? actor.staffId : null;
}

/**
 * Etkinlik personeli: etkin ekiplerin üyeleri ve liderleri, masa grubu süpervizörleri,
 * etkin personel atamaları ve kısım sorumluları.
 */
export async function eventStaffIds(ex: Executor, eventId: string): Promise<Set<string>> {
  return staffOf(await loadHierarchy(ex, eventId));
}

/**
 * Aktörün etkinlikte değerlendirebildiği personel ve dayanakları. Yönetici/admin tüm etkinlik personelini
 * `manager` dayanağıyla görür; diğerleri yalnızca hiyerarşi dayanaklarıyla. Aktörün kendisi asla yer almaz.
 */
export async function reviewableStaff(
  ex: Executor,
  actor: PolicyActor,
  eventId: string,
): Promise<Map<string, ReviewBasis[]>> {
  if (seesWholeEvent(actor)) {
    const map = new Map<string, ReviewBasis[]>();
    for (const id of await eventStaffIds(ex, eventId)) {
      if (id !== actor.staffId) map.set(id, ["manager"]);
    }
    return map;
  }
  if (!ownTeamOnly(actor)) return new Map();
  const reviewerId = hierarchyReviewerId(actor);
  if (reviewerId === null) return new Map();
  return reviewableBy(await loadHierarchy(ex, eventId), reviewerId);
}

/** X'i etkinlikte bir dayanakla değerlendirebilen personel kimlikleri (tekil, sıralı; X hariç). */
export async function reviewerStaffIdsFor(ex: Executor, eventId: string, staffId: string): Promise<string[]> {
  return reviewersOf(await loadHierarchy(ex, eventId), staffId);
}

function reviewersOf(h: EventHierarchy, staffId: string): string[] {
  const ids = new Set<string>();
  for (const t of h.teams) {
    if (t.leaderStaffId && t.memberIds.includes(staffId)) ids.add(t.leaderStaffId);
  }
  for (const g of h.groups) {
    if (groupScope(g).includes(staffId)) ids.add(g.supervisorStaffId);
  }
  if (staffOf(h).has(staffId)) for (const id of h.sectionHeadIds) ids.add(id);
  ids.delete(staffId);
  return [...ids].sort();
}

/**
 * Aktör X'i bu etkinlikte değerlendirebilir mi? Sıra: X etkinlik personeli değilse `not_found`;
 * modül izni olan aktör kendini hedeflediyse `conflict` (self); değerlendirici kümesinde değilse
 * `ForbiddenError`. Dönüş aktörün X için dayanaklarıdır (yönetici/admin için `["manager"]`).
 */
export async function assertCanReview(
  ex: Executor,
  actor: PolicyActor,
  eventId: string,
  staffId: string,
  verb: Verb,
): Promise<ReviewBasis[]> {
  const h = await loadHierarchy(ex, eventId);
  if (!staffOf(h).has(staffId)) throw new DomainError("not_found", REVIEW_MESSAGES.notOnTeam);
  // Değerlendirici kümesi X'in kendisini içermez; bu yüzden kendini hedefleyen aktör kümeyle hep reddedilirdi.
  // Modül izni olan aktöre (kendisi değerlendirici olsaydı izin alacak olana) açık "kendinizi..." hatası verilir;
  // izni olmayan aktör ForbiddenError alır, böylece izinsiz aktöre ek bilgi sızmaz.
  if (actor.staffId !== null && actor.staffId === staffId) {
    if (can(actor, "reviews", verb, { reviewerStaffIds: [staffId] })) {
      throw new DomainError("conflict", REVIEW_MESSAGES.self);
    }
  }
  authorize(actor, "reviews", verb, { reviewerStaffIds: reviewersOf(h, staffId) });
  if (actor.staffId === staffId) throw new DomainError("conflict", REVIEW_MESSAGES.self);
  if (seesWholeEvent(actor)) return ["manager"];
  const reviewerId = hierarchyReviewerId(actor);
  const bases = reviewerId === null ? undefined : reviewableBy(h, reviewerId).get(staffId);
  // authorize geçtiyse aktör kümededir; dayanak yoksa (yarış) kapalı başarısız ol.
  if (!bases) throw new DomainError("not_found", REVIEW_MESSAGES.notOnTeam);
  return bases;
}

/**
 * Aktörün en az bir değerlendirilebilir personeli olan etkinlikler, başlangıca göre sıralı.
 * Yönetici/admin için en az bir etkinlik personeli olan tüm etkinlikler.
 */
export async function reviewEventIds(ex: Executor, actor: PolicyActor): Promise<string[]> {
  const whole = seesWholeEvent(actor);
  const reviewerId = whole || !ownTeamOnly(actor) ? null : hierarchyReviewerId(actor);
  if (!whole && reviewerId === null) return [];

  const candidates = new Set<string>();
  const add = (rows: { eventId: string | null }[]) => {
    for (const r of rows) if (r.eventId) candidates.add(r.eventId);
  };
  if (whole) {
    add(await ex.selectDistinct({ eventId: teams.eventId }).from(teams).where(eq(teams.isActive, true)));
    add(
      await ex
        .selectDistinct({ eventId: tableGroups.eventId })
        .from(tableGroups)
        .where(isNotNull(tableGroups.supervisorStaffId)),
    );
    add(
      await ex
        .selectDistinct({ eventId: eventStaffAssignments.eventId })
        .from(eventStaffAssignments)
        .where(eq(eventStaffAssignments.isActive, true)),
    );
    add(await ex.selectDistinct({ eventId: eventSectionHeads.eventId }).from(eventSectionHeads));
  } else if (reviewerId !== null) {
    add(
      await ex
        .selectDistinct({ eventId: teams.eventId })
        .from(teams)
        .where(and(eq(teams.isActive, true), eq(teams.leaderStaffId, reviewerId))),
    );
    add(
      await ex
        .selectDistinct({ eventId: tableGroups.eventId })
        .from(tableGroups)
        .where(eq(tableGroups.supervisorStaffId, reviewerId)),
    );
    add(
      await ex
        .selectDistinct({ eventId: eventSectionHeads.eventId })
        .from(eventSectionHeads)
        .where(eq(eventSectionHeads.staffId, reviewerId)),
    );
  }
  if (candidates.size === 0) return [];

  const ordered = await ex
    .select({ id: events.id })
    .from(events)
    .where(inArray(events.id, [...candidates]))
    .orderBy(asc(events.startsAt), asc(events.id));
  const result: string[] = [];
  for (const { id } of ordered) {
    const h = await loadHierarchy(ex, id);
    const reviewable =
      reviewerId === null
        ? [...staffOf(h)].some((s) => s !== actor.staffId)
        : reviewableBy(h, reviewerId).size > 0;
    if (reviewable) result.push(id);
  }
  return result;
}
