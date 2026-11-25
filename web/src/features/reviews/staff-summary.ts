import { and, desc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, staff, staffPerformanceReviews } from "@/db/schema";
import { authorize, type PolicyActor } from "@/features/auth/policy";
import { average } from "./leader-stats";
import { ratingBand, type RatingBand } from "./score";

type Executor = Db | Tx;

export type StaffReviewSummary = {
  staffId: string;
  fullName: string;
  sicilNo: string;
  color: string | null;
  reviewCount: number;
  averageScore: number;
  band: RatingBand;
  lastReviewAt: string;
};

/**
 * Personel sayfasındaki "Değerlendirmeler" sekmesi: kişi başına tamamlanmış değerlendirme özeti.
 * Lider bu genel görünümü göremez (kendi ekibi için lider paneli vardır).
 * Özel notlar ve yorumlar bu özete girmez.
 */
export async function listStaffReviewSummaries(executor: Executor, actor: PolicyActor): Promise<StaffReviewSummary[]> {
  authorize(actor, "reviews", "view");
  const rows = await executor
    .select({
      staffId: staffPerformanceReviews.staffId,
      fullName: staff.fullName,
      sicilNo: staff.sicilNo,
      color: staff.color,
      score: staffPerformanceReviews.score,
      updatedAt: staffPerformanceReviews.updatedAt,
    })
    .from(staffPerformanceReviews)
    .innerJoin(staff, eq(staff.id, staffPerformanceReviews.staffId))
    .innerJoin(events, eq(events.id, staffPerformanceReviews.eventId))
    .where(eq(staffPerformanceReviews.isCompleted, true))
    .orderBy(desc(staffPerformanceReviews.updatedAt));
  const visible = rows;

  const byStaff = new Map<string, typeof visible>();
  for (const row of visible) byStaff.set(row.staffId, [...(byStaff.get(row.staffId) ?? []), row]);
  return [...byStaff.values()]
    .flatMap((list) => {
      const [latest] = list;
      const averageScore = average(list.map((r) => r.score));
      if (!latest || averageScore === null) return [];
      return [
        {
          staffId: latest.staffId,
          fullName: latest.fullName,
          sicilNo: latest.sicilNo,
          color: latest.color,
          reviewCount: list.length,
          averageScore,
          band: ratingBand(averageScore),
          lastReviewAt: latest.updatedAt.toISOString(),
        },
      ];
    })
    .sort((a, b) => b.averageScore - a.averageScore || a.fullName.localeCompare(b.fullName, "tr"));
}

export type StaffReviewHistoryItem = {
  eventId: string;
  eventName: string;
  score: number;
  band: RatingBand;
  completedAt: string;
};

/** Tek personelin tamamlanmış değerlendirme geçmişi (yeniden eskiye); özel notlar yok. */
export async function listStaffReviewHistory(
  executor: Executor,
  actor: PolicyActor,
  staffId: string,
): Promise<StaffReviewHistoryItem[]> {
  authorize(actor, "reviews", "view");
  const rows = await executor
    .select({
      eventId: events.id,
      eventName: events.name,
      score: staffPerformanceReviews.score,
      updatedAt: staffPerformanceReviews.updatedAt,
    })
    .from(staffPerformanceReviews)
    .innerJoin(events, eq(events.id, staffPerformanceReviews.eventId))
    .where(and(eq(staffPerformanceReviews.staffId, staffId), eq(staffPerformanceReviews.isCompleted, true)))
    .orderBy(desc(staffPerformanceReviews.updatedAt))
    .limit(50);
  return rows
    .map((r) => ({
      eventId: r.eventId,
      eventName: r.eventName,
      score: r.score,
      band: ratingBand(r.score),
      completedAt: r.updatedAt.toISOString(),
    }));
}
