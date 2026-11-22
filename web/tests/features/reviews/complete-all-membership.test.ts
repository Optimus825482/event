import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staffPerformanceReviews, teamMembers } from "@/db/schema";
import { completeAllReviews, saveReviewDraft } from "@/features/reviews/service";
import { truncateAll } from "../../helpers/db";
import { FULL_RATINGS, setupReviewWorld } from "./helpers";

const base = { strengths: [], improvements: [], recommendedTrainings: [] };

async function isCompleted(eventId: string, staffId: string) {
  const [row] = await db
    .select()
    .from(staffPerformanceReviews)
    .where(and(eq(staffPerformanceReviews.eventId, eventId), eq(staffPerformanceReviews.staffId, staffId)));
  return row?.isCompleted;
}

describe("completeAllReviews: güncel ekip üyeliği", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("başka liderin ekibine taşınan personelin taslağı tamamlanmaz, atlanan olarak raporlanır", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    await saveReviewDraft(db, w.leader, { ...base, eventId: w.event.id, staffId: w.member2.id, ratings: FULL_RATINGS });
    await db.update(teamMembers).set({ teamId: w.otherTeam.id }).where(eq(teamMembers.staffId, w.member1.id));

    const res = await completeAllReviews(db, w.leader, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 1, incomplete: 0, skipped: 1 });
    expect(await isCompleted(w.event.id, w.member1.id)).toBe(false);
    expect(await isCompleted(w.event.id, w.member2.id)).toBe(true);
  });

  it("ekipten çıkarılan personelin taslağı da atlanır", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    await db.delete(teamMembers).where(eq(teamMembers.staffId, w.member1.id));
    const res = await completeAllReviews(db, w.leader, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 0, skipped: 1, notification: null });
  });

  it("yönetici: etkinlikte aktif ekibi olan personel tamamlanır, ekipsiz olan atlanır", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.admin, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    await saveReviewDraft(db, w.admin, { ...base, eventId: w.event.id, staffId: w.otherMember.id, ratings: FULL_RATINGS });
    await db.delete(teamMembers).where(eq(teamMembers.staffId, w.otherMember.id));
    const res = await completeAllReviews(db, w.admin, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 1, skipped: 1 });
  });
});
