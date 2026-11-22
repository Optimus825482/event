import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, staffPerformanceReviews, teamMembers, teams, users } from "@/db/schema";
import { authorize, can, type PolicyResource, type Verb } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { insertNotification, type NotificationRow } from "@/features/notifications/service";
import { DomainError } from "@/lib/action";
import { REVIEW_MESSAGES } from "./labels";
import type { CompleteAllReviewsInput, CompleteReviewInput, ParsedSaveReviewInput } from "./schemas";
import { RATING_KEYS, computeScore, ratingBand } from "./score";

type Executor = Db | Tx;
export type ReviewRow = typeof staffPerformanceReviews.$inferSelect;
type EventRow = typeof events.$inferSelect;
type TeamRow = typeof teams.$inferSelect;

/** Lider için "kendi ekibim" kaynağı; menüdeki varsayımla aynı (bkz. features/auth/nav.ts). */
function ownResource(actor: Actor): PolicyResource | undefined {
  return actor.staffId ? { teamLeaderStaffId: actor.staffId } : undefined;
}

/** Ekip bilinmeden önce rol kapısı: staff/controller/venue_owner ve ekipsiz lider elenir. */
export function authorizeReviewsGate(actor: Actor, verb: Verb): void {
  authorize(actor, "reviews", verb, ownResource(actor));
}

/** Organizatör yalnızca kendi etkinliğini görür; başkasınınki "yok" gibi davranır. */
export async function loadReviewEvent(executor: Executor, actor: Actor, eventId: string): Promise<EventRow> {
  const [event] = await executor.select().from(events).where(eq(events.id, eventId));
  if (!event || !canAccessEvent(actor, event)) {
    throw new DomainError("not_found", REVIEW_MESSAGES.eventNotFound);
  }
  return event;
}

function assertWritable(event: EventRow): void {
  if (!event.reviewEnabled) throw new DomainError("conflict", REVIEW_MESSAGES.disabled);
}

/**
 * Personelin bu etkinlikteki ekibini bulur ve sahiplik denetimini yapar: lider yalnızca
 * kendi ekibindeki üyeyi değerlendirebilir (`authorize(..., "reviews", verb, { teamLeaderStaffId })`).
 */
async function resolveTeam(
  executor: Executor,
  actor: Actor,
  eventId: string,
  staffId: string,
  verb: Verb,
): Promise<TeamRow> {
  const candidates = await executor
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.staffId, staffId), eq(teams.eventId, eventId), eq(teams.isActive, true)));
  const own = candidates.find((c) => actor.staffId !== null && c.team.leaderStaffId === actor.staffId);
  const chosen = own ?? candidates[0];
  if (!chosen) throw new DomainError("not_found", REVIEW_MESSAGES.notOnTeam);
  authorize(actor, "reviews", verb, chosen.team.leaderStaffId ? { teamLeaderStaffId: chosen.team.leaderStaffId } : {});
  if (actor.staffId !== null && actor.staffId === staffId) {
    throw new DomainError("conflict", REVIEW_MESSAGES.self);
  }
  return chosen.team;
}

function isFullyRated(row: ReviewRow): boolean {
  return RATING_KEYS.every((key) => row[key] !== null);
}

/** Taslağı kaydeder (varsa günceller). Tamamlanmış değerlendirme tek ifadede, yarışa dayanıklı biçimde reddedilir. */
export async function saveReviewDraft(
  executor: Executor,
  actor: Actor,
  input: ParsedSaveReviewInput,
): Promise<ReviewRow> {
  // Kapı: ortak (zayıf) gereksinim. Asıl fiil, kaydın var olup olmadığına göre seçilir:
  // yeni taslak `create`, var olanı güncelleme `edit` ister (aktör izin satırlarını taşımalıdır).
  authorizeReviewsGate(actor, "view");
  const event = await loadReviewEvent(executor, actor, input.eventId);
  const [existing] = await executor
    .select({ id: staffPerformanceReviews.id })
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.eventId, input.eventId),
        eq(staffPerformanceReviews.staffId, input.staffId),
        eq(staffPerformanceReviews.reviewerId, actor.id),
      ),
    );
  await resolveTeam(executor, actor, input.eventId, input.staffId, existing ? "edit" : "create");
  assertWritable(event);

  const score = computeScore(input.ratings);
  const values = {
    score,
    rating: ratingBand(score),
    ...(Object.fromEntries(RATING_KEYS.map((key) => [key, input.ratings[key] ?? null])) as Record<
      (typeof RATING_KEYS)[number],
      number | null
    >),
    strengths: input.strengths,
    improvements: input.improvements,
    recommendedTrainings: input.recommendedTrainings,
    comment: input.comment ?? null,
    privateNotes: input.privateNotes ?? null,
    nextEventNotes: input.nextEventNotes ?? null,
  };

  const [row] = await executor
    .insert(staffPerformanceReviews)
    .values({ staffId: input.staffId, eventId: input.eventId, reviewerId: actor.id, ...values })
    .onConflictDoUpdate({
      target: [
        staffPerformanceReviews.staffId,
        staffPerformanceReviews.eventId,
        staffPerformanceReviews.reviewerId,
      ],
      set: { ...values, updatedAt: new Date() },
      setWhere: eq(staffPerformanceReviews.isCompleted, false),
    })
    .returning();
  if (!row) throw new DomainError("conflict", REVIEW_MESSAGES.locked);
  return row;
}

async function reviewerName(executor: Executor, actor: Actor): Promise<string> {
  const [row] = await executor.select({ name: users.name }).from(users).where(eq(users.id, actor.id));
  return row?.name ?? actor.username;
}

/** Tek değerlendirmeyi tamamlar ve kilitler; yöneticilere bildirim üretir (dönen satır yayın için). */
export async function completeReview(
  executor: Db,
  actor: Actor,
  input: CompleteReviewInput,
): Promise<{ review: ReviewRow; notification: NotificationRow }> {
  authorizeReviewsGate(actor, "edit");
  return executor.transaction(async (tx) => {
    const event = await loadReviewEvent(tx, actor, input.eventId);
    await resolveTeam(tx, actor, input.eventId, input.staffId, "edit");
    assertWritable(event);

    const [existing] = await tx
      .select()
      .from(staffPerformanceReviews)
      .where(
        and(
          eq(staffPerformanceReviews.eventId, input.eventId),
          eq(staffPerformanceReviews.staffId, input.staffId),
          eq(staffPerformanceReviews.reviewerId, actor.id),
        ),
      );
    if (!existing) throw new DomainError("not_found", REVIEW_MESSAGES.reviewNotFound);
    if (existing.isCompleted) throw new DomainError("conflict", REVIEW_MESSAGES.locked);
    if (!isFullyRated(existing)) throw new DomainError("invalid", REVIEW_MESSAGES.incomplete);

    const [review] = await tx
      .update(staffPerformanceReviews)
      .set({ isCompleted: true })
      .where(and(eq(staffPerformanceReviews.id, existing.id), eq(staffPerformanceReviews.isCompleted, false)))
      .returning();
    // Eşzamanlı ikinci tamamlama: satır kilidi beklendi, koşul artık sağlanmıyor.
    if (!review) throw new DomainError("conflict", REVIEW_MESSAGES.locked);

    const [person] = await tx.select({ fullName: staff.fullName }).from(staff).where(eq(staff.id, input.staffId));
    const reviewer = await reviewerName(tx, actor);
    const notification = await insertNotification(tx, {
      type: "staff_review_completed",
      title: "Personel Değerlendirmesi Yapıldı",
      message: `"${event.name}" etkinliğinde ${person?.fullName ?? "personel"} için ${reviewer} tarafından değerlendirme yapıldı.`,
      priority: "low",
      targetRole: "admin",
      eventId: event.id,
      createdById: actor.id,
      metadata: { staffName: person?.fullName ?? null, reviewerName: reviewer },
      actionUrl: `/leader/reviews/${event.id}`,
    });
    return { review, notification };
  });
}

/**
 * Taslak sahibinin, taslaktaki personeli şu an hâlâ değerlendirebildiği kümeyi bulur: personel
 * etkinlikte aktif bir ekipte olmalı ve tek değerlendirmedeki kural (`resolveTeam`) geçerli olmalı
 * (lider yalnızca kendi ekibini; kendini değil). Fırlatmaz; uygun olmayanlar atlanır.
 */
async function currentlyReviewable(
  executor: Executor,
  actor: Actor,
  eventId: string,
  staffIds: string[],
): Promise<Set<string>> {
  if (staffIds.length === 0) return new Set();
  const memberships = await executor
    .select({ staffId: teamMembers.staffId, leaderStaffId: teams.leaderStaffId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(inArray(teamMembers.staffId, staffIds), eq(teams.eventId, eventId), eq(teams.isActive, true)));
  const byStaff = new Map<string, (string | null)[]>();
  for (const m of memberships) byStaff.set(m.staffId, [...(byStaff.get(m.staffId) ?? []), m.leaderStaffId]);

  const allowed = new Set<string>();
  for (const [staffId, leaders] of byStaff) {
    if (actor.staffId !== null && actor.staffId === staffId) continue;
    const own = leaders.find((l) => actor.staffId !== null && l === actor.staffId);
    const chosen = own ?? leaders[0];
    if (can(actor, "reviews", "edit", chosen ? { teamLeaderStaffId: chosen } : {})) allowed.add(staffId);
  }
  return allowed;
}

/**
 * Etkinlikte kendi tam puanlı taslaklarını tamamlar; eksik puanlı taslaklara dokunmaz. Personel
 * artık aktörün yetkisindeki bir ekipte değilse (taşındı/lider değişti) taslak atlanır (`skipped`).
 */
export async function completeAllReviews(
  executor: Db,
  actor: Actor,
  input: CompleteAllReviewsInput,
): Promise<{ completed: number; incomplete: number; skipped: number; notification: NotificationRow | null }> {
  authorizeReviewsGate(actor, "edit");
  return executor.transaction(async (tx) => {
    const event = await loadReviewEvent(tx, actor, input.eventId);
    if (actor.role === "leader") {
      const [led] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.eventId, input.eventId), eq(teams.isActive, true), eq(teams.leaderStaffId, actor.staffId ?? "")));
      authorize(actor, "reviews", "edit", led && actor.staffId ? { teamLeaderStaffId: actor.staffId } : {});
    }
    assertWritable(event);

    const drafts = await tx
      .select()
      .from(staffPerformanceReviews)
      .where(
        and(
          eq(staffPerformanceReviews.eventId, input.eventId),
          eq(staffPerformanceReviews.reviewerId, actor.id),
          eq(staffPerformanceReviews.isCompleted, false),
        ),
      );
    const allowed = await currentlyReviewable(tx, actor, input.eventId, drafts.map((d) => d.staffId));
    const eligible = drafts.filter((d) => allowed.has(d.staffId));
    const skipped = drafts.length - eligible.length;
    const ready = eligible.filter(isFullyRated).map((d) => d.id);
    const done =
      ready.length === 0
        ? []
        : await tx
            .update(staffPerformanceReviews)
            .set({ isCompleted: true })
            .where(and(inArray(staffPerformanceReviews.id, ready), eq(staffPerformanceReviews.isCompleted, false)))
            .returning({ id: staffPerformanceReviews.id });

    if (done.length === 0) return { completed: 0, incomplete: eligible.length, skipped, notification: null };
    const reviewer = await reviewerName(tx, actor);
    const notification = await insertNotification(tx, {
      type: "staff_review_completed",
      title: "Toplu Değerlendirme Tamamlandı",
      message: `"${event.name}" etkinliğinde ${reviewer} tarafından ${done.length} personel değerlendirildi.`,
      priority: "low",
      targetRole: "admin",
      eventId: event.id,
      createdById: actor.id,
      metadata: { reviewerName: reviewer, reviewCount: done.length },
      actionUrl: `/leader/reviews/${event.id}`,
    });
    return { completed: done.length, incomplete: eligible.length - done.length, skipped, notification };
  });
}
