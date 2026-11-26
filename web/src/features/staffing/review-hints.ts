import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staffPerformanceReviews } from "@/db/schema";
import { can, type PolicyActor } from "@/features/auth/policy";
import type { RatingBand } from "@/features/reviews/score";

/** Personel seçicide gösterilen geçmiş değerlendirme özeti; özel not ve değerlendirici kimliği içermez. */
export type ReviewHint = {
  reviewCount: number;
  /** Yuvarlanmış tam sayı (0–100). */
  averageScore: number;
  lastBand: RatingBand;
  lastEventName: string;
  lastNextEventNotes: string | null;
};

/**
 * Geçmiş değerlendirme ipuçları. Yalnızca etkinlikte `review_history_visible` açıksa ve aktör
 * `staff:edit` sahibiyse döner (aksi halde boş); yalnızca tamamlanmış ve başka etkinliklere ait
 * satırlar sayılır. Sorgu yalnızca ipucunun ihtiyaç duyduğu sütunları seçer: `private_notes`,
 * `comment` ve değerlendirici kimliği hiç okunmaz. "Son" = başlangıcı en yeni etkinlik.
 */
export async function listReviewHints(
  ex: Db | Tx,
  actor: PolicyActor,
  event: { id: string; reviewHistoryVisible: boolean },
  staffIds: readonly string[],
): Promise<Record<string, ReviewHint>> {
  if (event.reviewHistoryVisible !== true || !can(actor, "staff", "edit") || staffIds.length === 0) return {};

  const rows = await ex
    .select({
      staffId: staffPerformanceReviews.staffId,
      score: staffPerformanceReviews.score,
      rating: staffPerformanceReviews.rating,
      nextEventNotes: staffPerformanceReviews.nextEventNotes,
      eventName: events.name,
    })
    .from(staffPerformanceReviews)
    .innerJoin(events, eq(events.id, staffPerformanceReviews.eventId))
    .where(
      and(
        inArray(staffPerformanceReviews.staffId, [...staffIds]),
        eq(staffPerformanceReviews.isCompleted, true),
        ne(staffPerformanceReviews.eventId, event.id),
      ),
    )
    // En yeni etkinlik önce; aynı etkinlikte en son güncellenen önce (kararlı sıra için kimlik).
    .orderBy(desc(events.startsAt), desc(staffPerformanceReviews.updatedAt), desc(staffPerformanceReviews.id));

  const sums = new Map<string, { count: number; total: number; last: (typeof rows)[number] }>();
  for (const row of rows) {
    const acc = sums.get(row.staffId);
    if (acc) {
      acc.count += 1;
      acc.total += row.score;
    } else {
      sums.set(row.staffId, { count: 1, total: row.score, last: row });
    }
  }

  const hints: Record<string, ReviewHint> = {};
  for (const [staffId, { count, total, last }] of sums) {
    hints[staffId] = {
      reviewCount: count,
      averageScore: Math.round(total / count),
      lastBand: last.rating,
      lastEventName: last.eventName,
      lastNextEventNotes: last.nextEventNotes,
    };
  }
  return hints;
}
