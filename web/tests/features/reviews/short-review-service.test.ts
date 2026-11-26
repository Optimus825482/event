import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staffPerformanceReviews } from "@/db/schema";
import { saveReviewDraft } from "@/features/reviews/service";
import { RATING_KEYS } from "@/features/reviews/score";
import { saveShortReview } from "@/features/reviews/short-review-service";
import { noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { FULL_RATINGS, expectDomain, expectForbidden, makeActor, setupReviewWorld } from "./helpers";

const short = (eventId: string, staffId: string, overallRating: number | null = 4) => ({
  eventId,
  staffId,
  overallRating,
  comment: null,
  nextEventNotes: null,
});

async function rowOf(eventId: string, staffId: string, reviewerId: string) {
  const [row] = await db
    .select()
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.eventId, eventId),
        eq(staffPerformanceReviews.staffId, staffId),
        eq(staffPerformanceReviews.reviewerId, reviewerId),
      ),
    );
  return row;
}

describe("saveShortReview", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kısa taslak 4 yıldızla kaydedilir: score 80, band successful, formKind short", async () => {
    const w = await setupReviewWorld();
    const row = await saveShortReview(db, w.leader, {
      ...short(w.event.id, w.member1.id, 4),
      comment: "İyi",
      nextEventNotes: "Bar'a verilsin",
    });
    expect(row.formKind).toBe("short");
    expect(row.overallRating).toBe(4);
    expect(row.score).toBe(80);
    expect(row.rating).toBe("successful");
    expect(row.isCompleted).toBe(false);
    expect(row.reviewerId).toBe(w.leader.id);
    expect(row.comment).toBe("İyi");
    expect(row.nextEventNotes).toBe("Bar'a verilsin");
  });

  it("aynı kişi için tekrar kayıt aynı satırı günceller", async () => {
    const w = await setupReviewWorld();
    const first = await saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 2));
    const second = await saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 5));
    expect(second.id).toBe(first.id);
    expect(second.score).toBe(100);
  });

  it("ayrıntılı taslak kısa forma geçince kategori puanları temizlenir", async () => {
    const w = await setupReviewWorld();
    const base = { eventId: w.event.id, staffId: w.member1.id, strengths: ["Dakik"], improvements: [], recommendedTrainings: [] };
    const full = await saveReviewDraft(db, w.leader, { ...base, ratings: FULL_RATINGS });
    expect(full.communication).toBe(5);
    const row = await saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 3));
    expect(row.id).toBe(full.id);
    for (const key of RATING_KEYS) expect(row[key]).toBeNull();
    expect(row.strengths).toEqual([]);
    expect(row.formKind).toBe("short");
  });

  it("kısa kayıt özel notlara dokunmaz", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, {
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
      privateNotes: "gizli",
    });
    const row = await saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 4));
    expect(row.privateNotes).toBe("gizli");
    expect((await rowOf(w.event.id, w.member1.id, w.leader.id))?.privateNotes).toBe("gizli");
  });

  it("tamamlanmış değerlendirme yeniden kaydedilemez", async () => {
    const w = await setupReviewWorld();
    await saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 4));
    await db
      .update(staffPerformanceReviews)
      .set({ isCompleted: true })
      .where(eq(staffPerformanceReviews.reviewerId, w.leader.id));
    const err = await expectDomain(saveShortReview(db, w.leader, short(w.event.id, w.member1.id, 1)), "conflict");
    expect(err.message).toContain("değiştirilemez");
    expect((await rowOf(w.event.id, w.member1.id, w.leader.id))?.overallRating).toBe(4);
  });

  it("kapsam dışı personel → ForbiddenError; izinsiz aktör → ForbiddenError", async () => {
    const w = await setupReviewWorld();
    await expectForbidden(saveShortReview(db, w.leader, short(w.event.id, w.otherMember.id)));
    const outsider = await makeActor(noAccessActor());
    await expectForbidden(saveShortReview(db, outsider, short(w.event.id, w.member1.id)));
  });

  it("kendini değerlendirme ve etkinlik personeli olmayan hedef reddedilir", async () => {
    const w = await setupReviewWorld();
    await expectDomain(saveShortReview(db, w.leader, short(w.event.id, w.leaderStaff.id)), "conflict");
    // Kapı varlık denetiminden önce: lider Forbidden, yönetici not_found.
    const unknown = crypto.randomUUID();
    await expectForbidden(saveShortReview(db, w.leader, short(w.event.id, unknown)));
    await expectDomain(saveShortReview(db, w.fnbManager, short(w.event.id, unknown)), "not_found");
  });

  it("olmayan etkinlik: izinsiz ve hiyerarşi aktörü Forbidden, yönetici not_found", async () => {
    const w = await setupReviewWorld();
    const input = short(crypto.randomUUID(), crypto.randomUUID());
    await expectForbidden(saveShortReview(db, await makeActor(noAccessActor()), input));
    await expectForbidden(saveShortReview(db, w.leader, input));
    await expectDomain(saveShortReview(db, w.fnbManager, input), "not_found");
  });

  it("yönetici etkinlikteki herkesi değerlendirebilir", async () => {
    const w = await setupReviewWorld();
    const row = await saveShortReview(db, w.fnbManager, short(w.event.id, w.otherMember.id, 5));
    expect(row.score).toBe(100);
  });

  it("değerlendirme kapalı etkinlik → conflict disabled; kayıt oluşmaz", async () => {
    const w = await setupReviewWorld({ reviewEnabled: false });
    const err = await expectDomain(saveShortReview(db, w.leader, short(w.event.id, w.member1.id)), "conflict");
    expect(err.message).toContain("kapalı");
    expect(await rowOf(w.event.id, w.member1.id, w.leader.id)).toBeUndefined();
  });
});
