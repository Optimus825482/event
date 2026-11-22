import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { completeAllReviews, completeReview, saveReviewDraft } from "@/features/reviews/service";
import { truncateAll } from "../../helpers/db";
import { FULL_RATINGS, expectForbidden, setupReviewWorld } from "./helpers";

/**
 * Not: `permission_module` enum'unda henüz "reviews" yok, bu yüzden izin satırı veritabanına
 * yazılamıyor; satırlar (eylem kapısının `withPermissions` ile yaptığı gibi) aktöre eklenir.
 */
function withRow(actor: Actor, flags: { canCreate: boolean; canEdit: boolean }) {
  return { ...actor, permissions: [{ module: "reviews" as const, canView: true, canDelete: false, ...flags }] };
}

const base = { strengths: [], improvements: [], recommendedTrainings: [] };

describe("değerlendirme servisi: create ve edit fiilleri ayrı denetlenir", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("canCreate=false, canEdit=true: yeni taslak açamaz, var olanı güncelleyebilir", async () => {
    const w = await setupReviewWorld();
    const input = { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS };
    await saveReviewDraft(db, w.leader, input);
    const actor = withRow(w.leader, { canCreate: false, canEdit: true });

    await saveReviewDraft(db, actor, { ...input, ratings: { communication: 1 } });
    await expectForbidden(saveReviewDraft(db, actor, { ...input, staffId: w.member2.id }));
  });

  it("canCreate=true, canEdit=false: yeni taslak açar; güncelleyemez, tamamlayamaz", async () => {
    const w = await setupReviewWorld();
    const actor = withRow(w.leader, { canCreate: true, canEdit: false });
    const input = { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS };

    await saveReviewDraft(db, actor, input);
    await expectForbidden(saveReviewDraft(db, actor, input));
    await expectForbidden(completeReview(db, actor, { eventId: w.event.id, staffId: w.member1.id }));
    await expectForbidden(completeAllReviews(db, actor, { eventId: w.event.id }));
  });

  it("canEdit=true ile tamamlanabilir", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    const actor = withRow(w.leader, { canCreate: false, canEdit: true });
    const { review } = await completeReview(db, actor, { eventId: w.event.id, staffId: w.member1.id });
    expect(review.isCompleted).toBe(true);
  });

  it("ikisi de kapalıysa kaydetme reddedilir", async () => {
    const w = await setupReviewWorld();
    const actor = withRow(w.leader, { canCreate: false, canEdit: false });
    await expectForbidden(
      saveReviewDraft(db, actor, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS }),
    );
  });
});
