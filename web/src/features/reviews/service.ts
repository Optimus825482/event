import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, staffPerformanceReviews, users } from "@/db/schema";
import { authorize, type PolicyResource, type Verb } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { insertNotification, type NotificationRow } from "@/features/notifications/service";
import { DomainError } from "@/lib/action";
import { assertCanReview, reviewableStaff } from "./authority";
import { REVIEW_MESSAGES } from "./labels";
import { REVIEW_ROUTES } from "./routes";
import type { CompleteAllReviewsInput, CompleteReviewInput, ParsedSaveReviewInput } from "./schemas";
import { RATING_KEYS, computeScore, ratingBand } from "./score";
import { isReviewComplete } from "./short-form";

type Executor = Db | Tx;
export type ReviewRow = typeof staffPerformanceReviews.$inferSelect;
type EventRow = typeof events.$inferSelect;

/** Hiyerarşi aktörü için kapı kaynağı: aktörün kendisi değerlendirici (bkz. features/auth/nav.ts). */
function ownResource(actor: Actor): PolicyResource | undefined {
  return actor.staffId ? { reviewerStaffIds: [actor.staffId] } : undefined;
}

/** Hedef bilinmeden önce izin kapısı: değerlendirme izni olmayanlar ve personel kaydı olmayan hiyerarşi aktörü elenir. */
export function authorizeReviewsGate(actor: Actor, verb: Verb): void {
  authorize(actor, "reviews", verb, ownResource(actor));
}

/**
 * Etkinlik kapsamı denetimi: hiyerarşi aktörü bu etkinlikte en az bir değerlendirilebilir personeli
 * yoksa reddedilir. Yönetici/admin için kaynak önemsizdir (her zaman geçer).
 */
export function authorizeEventScope(actor: Actor, verb: Verb, reviewable: ReadonlyMap<string, unknown>): void {
  authorize(actor, "reviews", verb, {
    reviewerStaffIds: reviewable.size > 0 && actor.staffId !== null ? [actor.staffId] : [],
  });
}

/** Değerlendirilecek etkinlik; yoksa `not_found`. */
export async function loadReviewEvent(executor: Executor, actor: Actor, eventId: string): Promise<EventRow> {
  const [event] = await executor.select().from(events).where(eq(events.id, eventId));
  if (!event) {
    // Kapı varlık denetiminden önce: yetkisiz aktör Forbidden alır; yönetici/admin not_found.
    authorize(actor, "reviews", "view", { reviewerStaffIds: [] });
    throw new DomainError("not_found", REVIEW_MESSAGES.eventNotFound);
  }
  return event;
}

function assertWritable(event: EventRow): void {
  if (!event.reviewEnabled) throw new DomainError("conflict", REVIEW_MESSAGES.disabled);
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
  await assertCanReview(executor, actor, input.eventId, input.staffId, existing ? "edit" : "create");
  assertWritable(event);

  const score = computeScore(input.ratings);
  // Ayrıntılı form kaydı: satır `full` olur, kısa formun genel puanı temizlenir (tamamlanmış satır değişmez).
  const values = {
    formKind: "full" as const,
    overallRating: null,
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
    await assertCanReview(tx, actor, input.eventId, input.staffId, "edit");
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
    if (!isReviewComplete(existing)) throw new DomainError("invalid", REVIEW_MESSAGES.incomplete);

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
      audience: "admin",
      eventId: event.id,
      createdById: actor.id,
      metadata: { staffName: person?.fullName ?? null, reviewerName: reviewer },
      actionUrl: REVIEW_ROUTES.reviewBoard(event.id),
    });
    return { review, notification };
  });
}

/**
 * Etkinlikte kendi tamamlanabilir taslaklarını tamamlar (`isReviewComplete`); eksiklere dokunmaz. Personel
 * artık aktörün değerlendirebildiği kümede değilse (taşındı, dayanak kalktı) taslak atlanır (`skipped`).
 */
export async function completeAllReviews(
  executor: Db,
  actor: Actor,
  input: CompleteAllReviewsInput,
): Promise<{ completed: number; incomplete: number; skipped: number; notification: NotificationRow | null }> {
  authorizeReviewsGate(actor, "edit");
  return executor.transaction(async (tx) => {
    const event = await loadReviewEvent(tx, actor, input.eventId);
    // Aktörün şu an değerlendirebildiği küme (hiyerarşi bir kez yüklenir); boşsa hiyerarşi aktörü reddedilir.
    const reviewable = await reviewableStaff(tx, actor, input.eventId);
    authorizeEventScope(actor, "edit", reviewable);
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
    const eligible = drafts.filter((d) => reviewable.has(d.staffId));
    const skipped = drafts.length - eligible.length;
    const ready = eligible.filter(isReviewComplete).map((d) => d.id);
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
      audience: "admin",
      eventId: event.id,
      createdById: actor.id,
      metadata: { reviewerName: reviewer, reviewCount: done.length },
      actionUrl: REVIEW_ROUTES.reviewBoard(event.id),
    });
    return { completed: done.length, incomplete: eligible.length - done.length, skipped, notification };
  });
}
