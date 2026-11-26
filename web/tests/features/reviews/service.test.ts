import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, notifications, staffPerformanceReviews, teamMembers } from "@/db/schema";
import { REVIEW_MESSAGES } from "@/features/reviews/labels";
import { completeAllReviews, completeReview, saveReviewDraft } from "@/features/reviews/service";
import { computeScore, type Ratings } from "@/features/reviews/score";
import { memberActor, noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { FULL_RATINGS, expectDomain, expectForbidden, makeActor, setupReviewWorld, makeLeader } from "./helpers";

async function reviewRows(eventId: string) {
  return db.select().from(staffPerformanceReviews).where(eq(staffPerformanceReviews.eventId, eventId));
}

describe("saveReviewDraft", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("lider kendi ekip üyesini değerlendirir; puan ve bant sunucuda hesaplanır", async () => {
    const w = await setupReviewWorld();
    const review = await saveReviewDraft(db, w.leader, {
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: FULL_RATINGS,
      strengths: ["Dakik"],
      improvements: [],
      recommendedTrainings: [],
      comment: "İyi",
    });
    expect(review.score).toBe(computeScore(FULL_RATINGS));
    expect(review.score).toBe(84);
    expect(review.rating).toBe("successful");
    expect(review.isCompleted).toBe(false);
    expect(review.reviewerId).toBe(w.leader.id);
    expect(review.strengths).toEqual(["Dakik"]);
    expect(review.communication).toBe(5);
  });

  it("aynı kişi için tekrar kayıt aynı satırı günceller (tek satır)", async () => {
    const w = await setupReviewWorld();
    const base = { eventId: w.event.id, staffId: w.member1.id, strengths: [], improvements: [], recommendedTrainings: [] };
    const first = await saveReviewDraft(db, w.leader, { ...base, ratings: { communication: 1 } });
    const second = await saveReviewDraft(db, w.leader, { ...base, ratings: FULL_RATINGS, comment: "Güncel" });
    expect(second.id).toBe(first.id);
    expect(second.comment).toBe("Güncel");
    expect(second.score).toBe(84);
    expect(await reviewRows(w.event.id)).toHaveLength(1);
  });

  it("değerlendirme kapalıyken yazılamaz ve hiçbir şey kaydedilmez", async () => {
    const w = await setupReviewWorld({ reviewEnabled: false });
    const err = await expectDomain(
      saveReviewDraft(db, w.leader, {
        eventId: w.event.id,
        staffId: w.member1.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
      "conflict",
    );
    expect(err.message).toContain("kapalı");
    expect(await reviewRows(w.event.id)).toHaveLength(0);
  });

  it("açıkken yazılan taslak, sistem sonradan kapatılınca tamamlanamaz ve değişemez", async () => {
    const w = await setupReviewWorld();
    const input = { eventId: w.event.id, staffId: w.member1.id, strengths: [], improvements: [], recommendedTrainings: [] };
    await saveReviewDraft(db, w.leader, { ...input, ratings: FULL_RATINGS });
    await db.update(events).set({ reviewEnabled: false }).where(eq(events.id, w.event.id));
    await expectDomain(saveReviewDraft(db, w.leader, { ...input, ratings: { communication: 0 } }), "conflict");
    await expectDomain(completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }), "conflict");
    await expectDomain(completeAllReviews(db, w.leader, { eventId: w.event.id }), "conflict");
    const [row] = await reviewRows(w.event.id);
    expect(row?.isCompleted).toBe(false);
    expect(row?.communication).toBe(5);
  });

  it("lider başka liderin ekibindeki personeli değerlendiremez", async () => {
    const w = await setupReviewWorld();
    await expectForbidden(
      saveReviewDraft(db, w.leader, {
        eventId: w.event.id,
        staffId: w.otherMember.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
    );
    expect(await reviewRows(w.event.id)).toHaveLength(0);
  });

  it("lider kendi ekibini değerlendirir, başka lider kendi üyesini", async () => {
    const w = await setupReviewWorld();
    const common = { strengths: [], improvements: [], recommendedTrainings: [], ratings: FULL_RATINGS };
    await saveReviewDraft(db, w.leader, { ...common, eventId: w.event.id, staffId: w.member2.id });
    await saveReviewDraft(db, w.otherLeader, { ...common, eventId: w.event.id, staffId: w.otherMember.id });
    expect(await reviewRows(w.event.id)).toHaveLength(2);
  });

  it("lider kendini değerlendiremez", async () => {
    const w = await setupReviewWorld();
    await expectDomain(
      saveReviewDraft(db, w.leader, {
        eventId: w.event.id,
        staffId: w.leaderStaff.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
      "conflict",
    );
  });

  it("bağlantısız (ekipte olmayan) personel: hiyerarşi lideri Forbidden, yönetici not_found", async () => {
    const w = await setupReviewWorld();
    const stranger = await f.createStaff(db);
    const input = {
      eventId: w.event.id,
      staffId: stranger.id,
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    };
    await expectForbidden(saveReviewDraft(db, w.leader, input));
    await expectDomain(saveReviewDraft(db, w.fnbManager, input), "not_found");
  });

  it("olmayan etkinlik: yetkisiz Forbidden, hiyerarşi lideri Forbidden, yönetici not_found", async () => {
    const w = await setupReviewWorld();
    const input = {
      eventId: crypto.randomUUID(),
      staffId: crypto.randomUUID(),
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    };
    await expectForbidden(saveReviewDraft(db, await makeActor(noAccessActor()), input));
    await expectForbidden(saveReviewDraft(db, w.leader, input));
    await expectDomain(saveReviewDraft(db, w.fnbManager, input), "not_found");
    const ids = { eventId: input.eventId };
    await expectForbidden(completeAllReviews(db, w.leader, ids));
    await expectDomain(completeAllReviews(db, w.fnbManager, ids), "not_found");
    await expectForbidden(completeReview(db, w.leader, { ...ids, staffId: input.staffId }));
    await expectDomain(completeReview(db, w.fnbManager, { ...ids, staffId: input.staffId }), "not_found");
  });

  it("kendini hedefleyen rolsüz lider: var olan ve olmayan etkinlikte aynı Forbidden", async () => {
    const w = await setupReviewWorld();
    const X = await f.createStaff(db);
    const x = await makeLeader(X.id);
    const base = { ratings: FULL_RATINGS, strengths: [], improvements: [], recommendedTrainings: [] };
    for (const eventId of [w.event.id, crypto.randomUUID()]) {
      await expectForbidden(saveReviewDraft(db, x, { ...base, eventId, staffId: X.id }));
      await expectForbidden(completeReview(db, x, { eventId, staffId: X.id }));
    }
  });

  it("kapsam dışı personel, değerlendirme kapalı etkinlikte de Forbidden (disabled değil)", async () => {
    const w = await setupReviewWorld({ reviewEnabled: false });
    await expectForbidden(
      saveReviewDraft(db, w.leader, {
        eventId: w.event.id,
        staffId: w.otherMember.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
    );
    await expectForbidden(completeReview(db, w.leader, { eventId: w.event.id, staffId: w.otherMember.id }));
  });


  it("personelin başka etkinlikteki ekibi bu etkinlik için geçerli değil", async () => {
    const w = await setupReviewWorld();
    const otherEvent = await f.createEvent(db, { organizerId: w.fnbManager.id, reviewEnabled: true });
    // Lider o etkinlikte rol sahibi değil: Forbidden (kapı varlık denetiminden önce).
    await expectForbidden(
      saveReviewDraft(db, w.leader, {
        eventId: otherEvent.id,
        staffId: w.member1.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
    );
  });

  it("olmayan etkinlik: yönetici için not_found", async () => {
    const w = await setupReviewWorld();
    await expectDomain(
      saveReviewDraft(db, w.fnbManager, {
        eventId: "00000000-0000-4000-8000-000000000000",
        staffId: w.member1.id,
        ratings: FULL_RATINGS,
        strengths: [],
        improvements: [],
        recommendedTrainings: [],
      }),
      "not_found",
    );
  });

  it("değerlendirme izni olmayanlar değerlendiremez; admin ve F&B yöneticisi değerlendirir", async () => {
    const w = await setupReviewWorld();
    const input = {
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    };
    await expectForbidden(saveReviewDraft(db, await makeActor(noAccessActor()), input));
    await expectForbidden(saveReviewDraft(db, await makeActor(memberActor("casino", { check_in: "vc--" })), input));
    await saveReviewDraft(db, w.admin, input);
    await saveReviewDraft(db, w.fnbManager, input);
    expect(await reviewRows(w.event.id)).toHaveLength(2);
  });

  it("aynı anda 8 kayıt tek satır bırakır ve hata vermez", async () => {
    const w = await setupReviewWorld();
    const base = { eventId: w.event.id, staffId: w.member1.id, strengths: [], improvements: [], recommendedTrainings: [] };
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        saveReviewDraft(db, w.leader, { ...base, ratings: { communication: i % 6 } }),
      ),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await reviewRows(w.event.id)).toHaveLength(1);
  });
});

describe("completeReview", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function draft(w: Awaited<ReturnType<typeof setupReviewWorld>>, staffId: string, ratings: Ratings = FULL_RATINGS) {
    return saveReviewDraft(db, w.leader, {
      eventId: w.event.id,
      staffId,
      ratings,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    });
  }

  it("tamamlar, kilitler ve yöneticiye bildirim üretir", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    const done = await completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id });
    expect(done.review.isCompleted).toBe(true);
    expect(done.notification).toMatchObject({ type: "staff_review_completed", audience: "admin", eventId: w.event.id });
    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(1);
  });

  it("tamamlanan değerlendirme kilitlenir: kaydetme ve yeniden tamamlama conflict, satır değişmez", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    await completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id });
    const before = (await reviewRows(w.event.id))[0];

    const err = await expectDomain(draft(w, w.member1.id, { communication: 0 }), "conflict");
    expect(err.message).toContain("Tamamlanan");
    await expectDomain(completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }), "conflict");

    const after = (await reviewRows(w.event.id))[0];
    expect(after).toEqual(before);
    expect(await db.select().from(notifications)).toHaveLength(1);
  });

  it("tamamlandıktan sonra eşzamanlı kayıtların hepsi reddedilir", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    await completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id });
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => draft(w, w.member1.id, { communication: 0 })),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect((await reviewRows(w.event.id))[0]?.communication).toBe(5);
  });

  it("eşzamanlı iki tamamlamadan yalnızca biri başarılı olur, tek bildirim", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    const results = await Promise.allSettled([
      completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }),
      completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(notifications)).toHaveLength(1);
  });

  it("tüm kategoriler puanlanmadan tamamlanamaz (invalid)", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id, { communication: 5 });
    const err = await expectDomain(
      completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }),
      "invalid",
    );
    expect(err.message).toBe(REVIEW_MESSAGES.incomplete);
    expect((await reviewRows(w.event.id))[0]?.isCompleted).toBe(false);
  });

  it("taslağı olmayan personel not_found", async () => {
    const w = await setupReviewWorld();
    await expectDomain(completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }), "not_found");
  });

  it("başka liderin değerlendirmesini tamamlayamaz", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    await expectForbidden(completeReview(db, w.otherLeader, { eventId: w.event.id, staffId: w.member1.id }));
    expect((await reviewRows(w.event.id))[0]?.isCompleted).toBe(false);
  });

  it("üye ekipten çıkarılırsa lider artık değerlendiremez", async () => {
    const w = await setupReviewWorld();
    await draft(w, w.member1.id);
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, w.team.id), eq(teamMembers.staffId, w.member1.id)));
    await expectForbidden(completeReview(db, w.leader, { eventId: w.event.id, staffId: w.member1.id }));
  });
});

describe("completeAllReviews", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("tam puanlı taslakları tamamlar, eksikleri bırakır, tek özet bildirimi üretir", async () => {
    const w = await setupReviewWorld();
    const base = { eventId: w.event.id, strengths: [], improvements: [], recommendedTrainings: [] };
    await saveReviewDraft(db, w.leader, { ...base, staffId: w.member1.id, ratings: FULL_RATINGS });
    await saveReviewDraft(db, w.leader, { ...base, staffId: w.member2.id, ratings: { communication: 3 } });
    await saveReviewDraft(db, w.otherLeader, { ...base, staffId: w.otherMember.id, ratings: FULL_RATINGS });

    const res = await completeAllReviews(db, w.leader, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 1, incomplete: 1 });
    expect(res.notification).toMatchObject({ type: "staff_review_completed", audience: "admin" });

    const rows = await reviewRows(w.event.id);
    const byStaff = new Map(rows.map((r) => [r.staffId, r.isCompleted]));
    expect(byStaff.get(w.member1.id)).toBe(true);
    expect(byStaff.get(w.member2.id)).toBe(false);
    expect(byStaff.get(w.otherMember.id)).toBe(false);
  });

  it("tamamlanacak bir şey yoksa bildirim üretmez", async () => {
    const w = await setupReviewWorld();
    const res = await completeAllReviews(db, w.leader, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 0, incomplete: 0, notification: null });
    expect(await db.select().from(notifications)).toHaveLength(0);
  });

  it("ekibi olmayan lider forbidden", async () => {
    const w = await setupReviewWorld();
    const lonelyStaff = await f.createStaff(db);
    const lonely = await makeLeader(lonelyStaff.id);
    await expectForbidden(completeAllReviews(db, lonely, { eventId: w.event.id }));
  });
});
