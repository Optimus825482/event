import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { staffPerformanceReviews } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { assertCanReview } from "./authority";
import { REVIEW_MESSAGES } from "./labels";
import { authorizeReviewsGate, loadReviewEvent, type ReviewRow } from "./service";
import { shortReviewValues, type ShortReviewInput } from "./short-form";

/**
 * Kısa formu taslak olarak kaydeder (varsa günceller). Kategori puanları ve listeler temizlenir;
 * `private_notes` yazılmaz, böylece ayrıntılı taslaktan kalan özel notlar korunur.
 * Tamamlanmış değerlendirme tek ifadede, yarışa dayanıklı biçimde reddedilir.
 */
export async function saveShortReview(ex: Db | Tx, actor: Actor, input: ShortReviewInput): Promise<ReviewRow> {
  // Kapı önde: modül izni olmayan aktör, personel/etkinlik varlığı hakkında bilgi edinmez.
  authorizeReviewsGate(actor, "view");
  const event = await loadReviewEvent(ex, actor, input.eventId);
  const [existing] = await ex
    .select({ id: staffPerformanceReviews.id })
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.eventId, input.eventId),
        eq(staffPerformanceReviews.staffId, input.staffId),
        eq(staffPerformanceReviews.reviewerId, actor.id),
      ),
    );
  await assertCanReview(ex, actor, input.eventId, input.staffId, existing ? "edit" : "create");
  if (!event.reviewEnabled) throw new DomainError("conflict", REVIEW_MESSAGES.disabled);

  const { formKind, overallRating, score, rating, comment, nextEventNotes, strengths, improvements, recommendedTrainings, ...ratings } =
    shortReviewValues(input);
  const values = {
    ...ratings,
    formKind,
    overallRating,
    score,
    rating,
    strengths,
    improvements,
    recommendedTrainings,
    comment,
    nextEventNotes,
  };

  const [row] = await ex
    .insert(staffPerformanceReviews)
    .values({ staffId: input.staffId, eventId: input.eventId, reviewerId: actor.id, ...values })
    .onConflictDoUpdate({
      target: [staffPerformanceReviews.staffId, staffPerformanceReviews.eventId, staffPerformanceReviews.reviewerId],
      set: { ...values, updatedAt: new Date() },
      setWhere: eq(staffPerformanceReviews.isCompleted, false),
    })
    .returning();
  if (!row) throw new DomainError("conflict", REVIEW_MESSAGES.locked);
  return row;
}
