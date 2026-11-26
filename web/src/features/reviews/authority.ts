import { and, asc, eq, exists, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventSectionHeads,
  eventStaffAssignments,
  events,
  staff,
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

/**
 * `leaderActive` / `supervisorActive` / `activeSectionHeadIds`: dayanak yalnızca personel kaydı etkin olan
 * kişiye aittir (pasif ya da işten ayrılmış kaydın hesabı hiyerarşiyle yetki kazanmaz). Kişi yine de etkinlik
 * personeli olarak sayılır ve değerlendirilebilir.
 */
type HierarchyTeam = { leaderStaffId: string | null; leaderActive: boolean; memberIds: string[] };
type HierarchyGroup = { supervisorStaffId: string; supervisorActive: boolean; team: HierarchyTeam | null; tableStaffIds: string[] };

/** Bir etkinliğin değerlendirme hiyerarşisi: yalnızca etkin, etkinliğe ait ekipler ve etkin atamalar. */
type EventHierarchy = {
  teams: HierarchyTeam[];
  groups: HierarchyGroup[];
  sectionHeadIds: string[];
  activeSectionHeadIds: string[];
  assignedStaffIds: string[];
};

const emptyHierarchy = (): EventHierarchy => ({
  teams: [],
  groups: [],
  sectionHeadIds: [],
  activeSectionHeadIds: [],
  assignedStaffIds: [],
});

/**
 * Verilen etkinliklerin hiyerarşilerini toplu yükler: etkinlik sayısından bağımsız olarak en fazla 6 sorgu
 * (liderin/süpervizörün/kısım sorumlusunun personel durumu mevcut sorgulara birleştirilir).
 * Dönen haritada istenen her etkinlik vardır (personeli yoksa boş hiyerarşi).
 */
async function loadHierarchies(ex: Executor, eventIds: readonly string[]): Promise<Map<string, EventHierarchy>> {
  const result = new Map<string, EventHierarchy>(eventIds.map((id) => [id, emptyHierarchy()]));
  if (eventIds.length === 0) return result;
  const ids = [...eventIds];
  const of = (eventId: string | null) => (eventId === null ? undefined : result.get(eventId));

  const teamRows = await ex
    .select({
      id: teams.id,
      eventId: teams.eventId,
      leaderStaffId: teams.leaderStaffId,
      leaderStatus: staff.status,
    })
    .from(teams)
    .leftJoin(staff, eq(staff.id, teams.leaderStaffId))
    .where(and(inArray(teams.eventId, ids), eq(teams.isActive, true)));
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
  // Ekip, etkinliğiyle birlikte anahtarlanır: başka etkinliğin ekibine bağlı grup ona ulaşamaz.
  const teamKey = (eventId: string | null, teamId: string) => `${eventId}:${teamId}`;
  const teamByKey = new Map<string, HierarchyTeam>();
  const teamById = new Map<string, HierarchyTeam>();
  for (const t of teamRows) {
    const team: HierarchyTeam = { leaderStaffId: t.leaderStaffId, leaderActive: t.leaderStatus === "active", memberIds: [] };
    teamByKey.set(teamKey(t.eventId, t.id), team);
    teamById.set(t.id, team);
    of(t.eventId)?.teams.push(team);
  }
  for (const m of memberRows) teamById.get(m.teamId)?.memberIds.push(m.staffId);

  const groupRows = await ex
    .select({
      id: tableGroups.id,
      eventId: tableGroups.eventId,
      teamId: tableGroups.teamId,
      supervisorStaffId: tableGroups.supervisorStaffId,
      supervisorStatus: staff.status,
    })
    .from(tableGroups)
    .leftJoin(staff, eq(staff.id, tableGroups.supervisorStaffId))
    .where(and(inArray(tableGroups.eventId, ids), isNotNull(tableGroups.supervisorStaffId)));
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
          .where(and(inArray(tableGroupTables.eventId, ids), eq(eventStaffAssignments.isActive, true)));
  const tableStaffByGroup = new Map<string, string[]>();
  for (const r of tableStaffRows) {
    const list = tableStaffByGroup.get(r.groupId);
    if (list) list.push(r.staffId);
    else tableStaffByGroup.set(r.groupId, [r.staffId]);
  }
  for (const g of groupRows) {
    of(g.eventId)?.groups.push({
      // Sorguda NULL süpervizörler elendi.
      supervisorStaffId: g.supervisorStaffId as string,
      supervisorActive: g.supervisorStatus === "active",
      // Pasif ya da başka etkinliğin ekibi dayanak üretmez.
      team: g.teamId ? (teamByKey.get(teamKey(g.eventId, g.teamId)) ?? null) : null,
      tableStaffIds: tableStaffByGroup.get(g.id) ?? [],
    });
  }

  const headRows = await ex
    .select({ eventId: eventSectionHeads.eventId, staffId: eventSectionHeads.staffId, status: staff.status })
    .from(eventSectionHeads)
    .leftJoin(staff, eq(staff.id, eventSectionHeads.staffId))
    .where(inArray(eventSectionHeads.eventId, ids));
  for (const r of headRows) {
    of(r.eventId)?.sectionHeadIds.push(r.staffId);
    if (r.status === "active") of(r.eventId)?.activeSectionHeadIds.push(r.staffId);
  }

  const assignmentRows = await ex
    .select({ eventId: eventStaffAssignments.eventId, staffId: eventStaffAssignments.staffId })
    .from(eventStaffAssignments)
    .where(and(inArray(eventStaffAssignments.eventId, ids), eq(eventStaffAssignments.isActive, true)));
  for (const r of assignmentRows) of(r.eventId)?.assignedStaffIds.push(r.staffId);

  return result;
}

async function loadHierarchy(ex: Executor, eventId: string): Promise<EventHierarchy> {
  return (await loadHierarchies(ex, [eventId])).get(eventId) ?? emptyHierarchy();
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
    if (t.leaderActive && t.leaderStaffId === reviewerId) for (const m of t.memberIds) found.captain.add(m);
  }
  for (const g of h.groups) {
    if (g.supervisorActive && g.supervisorStaffId === reviewerId) for (const id of groupScope(g)) found.supervisor.add(id);
  }
  if (h.activeSectionHeadIds.includes(reviewerId)) for (const id of staffOf(h)) found.section_head.add(id);

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
  return (await reviewableStaffByEvent(ex, actor, [eventId])).get(eventId) ?? new Map();
}

/**
 * `reviewableStaff`'ın toplu biçimi: her etkinlik için aynı sonuç, tek toplu hiyerarşi yüklemesiyle
 * (etkinlik sayısından bağımsız en fazla 6 sorgu; değerlendiremeyen aktör için hiç sorgu yok).
 * Dönen haritada istenen her etkinlik vardır (değerlendirilebilir kimse yoksa boş harita).
 */
export async function reviewableStaffByEvent(
  ex: Executor,
  actor: PolicyActor,
  eventIds: readonly string[],
): Promise<Map<string, Map<string, ReviewBasis[]>>> {
  const ids = [...new Set(eventIds)];
  const result = new Map<string, Map<string, ReviewBasis[]>>(ids.map((id) => [id, new Map()]));
  if (ids.length === 0) return result;
  if (seesWholeEvent(actor)) {
    const hierarchies = await loadHierarchies(ex, ids);
    for (const id of ids) {
      const map = new Map<string, ReviewBasis[]>();
      for (const staffId of staffOf(hierarchies.get(id) ?? emptyHierarchy())) {
        if (staffId !== actor.staffId) map.set(staffId, ["manager"]);
      }
      result.set(id, map);
    }
    return result;
  }
  if (!ownTeamOnly(actor)) return result;
  const reviewerId = hierarchyReviewerId(actor);
  if (reviewerId === null) return result;
  const hierarchies = await loadHierarchies(ex, ids);
  for (const id of ids) result.set(id, reviewableBy(hierarchies.get(id) ?? emptyHierarchy(), reviewerId));
  return result;
}

/** X'i etkinlikte bir dayanakla değerlendirebilen personel kimlikleri (tekil, sıralı; X hariç). */
export async function reviewerStaffIdsFor(ex: Executor, eventId: string, staffId: string): Promise<string[]> {
  return reviewersOf(await loadHierarchy(ex, eventId), staffId);
}

function reviewersOf(h: EventHierarchy, staffId: string): string[] {
  const ids = new Set<string>();
  for (const t of h.teams) {
    if (t.leaderActive && t.leaderStaffId && t.memberIds.includes(staffId)) ids.add(t.leaderStaffId);
  }
  for (const g of h.groups) {
    if (g.supervisorActive && groupScope(g).includes(staffId)) ids.add(g.supervisorStaffId);
  }
  if (staffOf(h).has(staffId)) for (const id of h.activeSectionHeadIds) ids.add(id);
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
  // Kendini hedefleyen aktör buraya yalnızca izinsizse gelir: küme onu içermediği için authorize reddeder.
  authorize(actor, "reviews", verb, { reviewerStaffIds: reviewersOf(h, staffId) });
  if (seesWholeEvent(actor)) return ["manager"];
  const reviewerId = hierarchyReviewerId(actor);
  const bases = reviewerId === null ? undefined : reviewableBy(h, reviewerId).get(staffId);
  // authorize geçtiyse aktör kümededir; dayanak yoksa (yarış) kapalı başarısız ol.
  if (!bases) throw new DomainError("not_found", REVIEW_MESSAGES.notOnTeam);
  return bases;
}

/** EXISTS alt sorgularının seçtiği sabit. */
const ONE = sql`1`;

/**
 * Aktörün en az bir değerlendirilebilir personeli olan etkinlikler, başlangıca göre sıralı.
 * Yönetici/admin için aktörün kendisi dışında en az bir etkinlik personeli olan tüm etkinlikler.
 * Sorgu sayısı etkinlik sayısından bağımsızdır (yönetici: 1; hiyerarşi: aday sorgusu + en fazla 6).
 */
export async function reviewEventIds(ex: Executor, actor: PolicyActor): Promise<string[]> {
  if (seesWholeEvent(actor)) return wholeEventIds(ex, actor.staffId);
  if (!ownTeamOnly(actor)) return [];
  const reviewerId = hierarchyReviewerId(actor);
  if (reviewerId === null) return [];

  // Aday etkinlikler: aktörün etkin ekip liderliği, süpervizörlüğü ya da kısım sorumluluğu olanlar.
  const candidates = await ex
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        // Aktörün personel kaydı etkin değilse hiyerarşi yetki vermez: aday yok, hiyerarşi yüklenmez.
        exists(ex.select({ one: ONE }).from(staff).where(and(eq(staff.id, reviewerId), eq(staff.status, "active")))),
        or(
        exists(
          ex
            .select({ one: ONE })
            .from(teams)
            .where(and(eq(teams.eventId, events.id), eq(teams.isActive, true), eq(teams.leaderStaffId, reviewerId))),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(tableGroups)
            .where(and(eq(tableGroups.eventId, events.id), eq(tableGroups.supervisorStaffId, reviewerId))),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(eventSectionHeads)
            .where(and(eq(eventSectionHeads.eventId, events.id), eq(eventSectionHeads.staffId, reviewerId))),
        ),
      ),
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.id));
  const ids = candidates.map((e) => e.id);
  const hierarchies = await loadHierarchies(ex, ids);
  return ids.filter((id) => reviewableBy(hierarchies.get(id) ?? emptyHierarchy(), reviewerId).size > 0);
}

/** Tek sorgu: `staffOf` kaynaklarından birinde aktörden başka personel bulunan etkinlikler. */
async function wholeEventIds(ex: Executor, selfStaffId: string | null): Promise<string[]> {
  const notSelf = (column: AnyPgColumn) => (selfStaffId === null ? sql`true` : ne(column, selfStaffId));
  const rows = await ex
    .select({ id: events.id })
    .from(events)
    .where(
      or(
        exists(
          ex
            .select({ one: ONE })
            .from(teams)
            .where(
              and(
                eq(teams.eventId, events.id),
                eq(teams.isActive, true),
                isNotNull(teams.leaderStaffId),
                notSelf(teams.leaderStaffId),
              ),
            ),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(teamMembers)
            .innerJoin(teams, eq(teams.id, teamMembers.teamId))
            .where(and(eq(teams.eventId, events.id), eq(teams.isActive, true), notSelf(teamMembers.staffId))),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(tableGroups)
            .where(
              and(
                eq(tableGroups.eventId, events.id),
                isNotNull(tableGroups.supervisorStaffId),
                notSelf(tableGroups.supervisorStaffId),
              ),
            ),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(eventStaffAssignments)
            .where(
              and(
                eq(eventStaffAssignments.eventId, events.id),
                eq(eventStaffAssignments.isActive, true),
                notSelf(eventStaffAssignments.staffId),
              ),
            ),
        ),
        exists(
          ex
            .select({ one: ONE })
            .from(eventSectionHeads)
            .where(and(eq(eventSectionHeads.eventId, events.id), notSelf(eventSectionHeads.staffId))),
        ),
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.id));
  return rows.map((r) => r.id);
}
