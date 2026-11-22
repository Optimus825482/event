import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staffPerformanceReviews, teams } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { reviewActionDefs } from "@/features/reviews/action-defs";
import { getReviewBoard, listReviewableEvents } from "@/features/reviews/queries";
import { saveReviewDraft } from "@/features/reviews/service";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { FULL_RATINGS, expectForbidden, makeActor, setupReviewWorld } from "./helpers";
import { eq } from "drizzle-orm";

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    save: defineAction(reviewActionDefs.save),
    complete: defineAction(reviewActionDefs.complete),
    completeAll: defineAction(reviewActionDefs.completeAll),
  };
}

describe("review actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oturumsuz unauthenticated; staff ve controller forbidden", async () => {
    const w = await setupReviewWorld();
    const input = { eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS };
    expect(await actionsFor(null).save(input)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await actionsFor(await makeActor("staff")).save(input)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await actionsFor(await makeActor("controller")).save(input)).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("lider eylemle kaydeder, tamamlar; tamamlanan kilitli", async () => {
    const w = await setupReviewWorld();
    const a = actionsFor(w.leader);
    const input = { eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS, strengths: ["A"] };
    const saved = await a.save(input);
    expect(saved).toMatchObject({ ok: true, data: { score: 84, band: "successful" } });
    expect(await a.complete({ eventId: w.event.id, staffId: w.member1.id })).toMatchObject({ ok: true });
    expect(await a.save(input)).toMatchObject({ ok: false, code: "conflict" });
  });

  it("lider başka ekibin üyesi için forbidden alır", async () => {
    const w = await setupReviewWorld();
    const res = await actionsFor(w.leader).save({ eventId: w.event.id, staffId: w.otherMember.id, ratings: FULL_RATINGS });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("kapalı sistemde conflict", async () => {
    const w = await setupReviewWorld({ reviewEnabled: false });
    const res = await actionsFor(w.leader).save({ eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    expect(res).toMatchObject({ ok: false, code: "conflict" });
  });

  it("aralık dışı puan alan hatası verir; sunucu skoru istemciden almaz", async () => {
    const w = await setupReviewWorld();
    const res = await actionsFor(w.leader).save({
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: { communication: 6 },
    });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    if (!res.ok) expect(res.fieldErrors?.["ratings.communication"]?.length).toBeGreaterThan(0);

    const forged = await actionsFor(w.leader).save({
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: { communication: 0 },
      score: 100,
      rating: "excellent",
    });
    expect(forged).toMatchObject({ ok: true, data: { score: 0, band: "very_bad" } });
  });

  it("toplu tamamlama özet döner", async () => {
    const w = await setupReviewWorld();
    const a = actionsFor(w.leader);
    await a.save({ eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    await a.save({ eventId: w.event.id, staffId: w.member2.id, ratings: { teamwork: 2 } });
    expect(await a.completeAll({ eventId: w.event.id })).toMatchObject({ ok: true, data: { completed: 1, incomplete: 1 } });
  });
});

describe("review queries", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("lider yalnızca kendi ekibini ve kendi değerlendirmelerini görür; lider listede yok", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, {
      eventId: w.event.id,
      staffId: w.member1.id,
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    });
    await saveReviewDraft(db, w.otherLeader, {
      eventId: w.event.id,
      staffId: w.otherMember.id,
      ratings: FULL_RATINGS,
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
    });

    const board = await getReviewBoard(db, w.leader, w.event.id);
    expect(board.teams.map((t) => t.name)).toEqual(["A Ekibi"]);
    const members = board.teams[0]?.members ?? [];
    expect(members.map((m) => m.fullName)).toEqual(["Üye Bir", "Üye İki"]);
    expect(members.find((m) => m.fullName === "Üye Bir")?.review).toMatchObject({ score: 84, band: "successful", isCompleted: false });
    expect(members.find((m) => m.fullName === "Üye İki")?.review).toBeNull();
    expect(board.event.reviewEnabled).toBe(true);
  });

  it("admin tüm ekipleri görür; başka organizatör etkinliği göremez", async () => {
    const w = await setupReviewWorld();
    expect((await getReviewBoard(db, w.admin, w.event.id)).teams).toHaveLength(2);
    expect((await getReviewBoard(db, w.organizer, w.event.id)).teams).toHaveLength(2);
    await expect(getReviewBoard(db, await makeActor("organizer"), w.event.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ekibi olmayan lider etkinlik panosunu göremez; staff yetkisiz", async () => {
    const w = await setupReviewWorld();
    const lonely = await makeActor("leader", (await f.createStaff(db)).id);
    await expectForbidden(getReviewBoard(db, lonely, w.event.id));
    await expectForbidden(getReviewBoard(db, await makeActor("staff"), w.event.id));
    await expectForbidden(listReviewableEvents(db, await makeActor("controller")));
  });

  it("etkinlik listesi: lider yalnızca ekip yönettiği etkinlikleri görür, sayılar doğru", async () => {
    const w = await setupReviewWorld();
    const other = await f.createEvent(db, { organizerId: w.organizer.id });
    await db.insert(teams).values({ eventId: other.id, name: "Z", leaderStaffId: w.otherLeader.staffId });
    const input = { eventId: w.event.id, strengths: [], improvements: [], recommendedTrainings: [] };
    await saveReviewDraft(db, w.leader, { ...input, staffId: w.member1.id, ratings: FULL_RATINGS });
    await db.update(staffPerformanceReviews).set({ isCompleted: true }).where(eq(staffPerformanceReviews.staffId, w.member1.id));

    const list = await listReviewableEvents(db, w.leader);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: w.event.id, teamCount: 1, memberCount: 2, completedCount: 1, reviewEnabled: true });

    expect(await listReviewableEvents(db, w.admin)).toHaveLength(2);
    expect(await listReviewableEvents(db, await makeActor("organizer"))).toHaveLength(0);
  });

  it("eylem sonucu board'a yansır: tamamlanan görünüm kilitli işaretlidir", async () => {
    const w = await setupReviewWorld();
    const a = actionsFor(w.leader);
    await a.save({ eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    await a.complete({ eventId: w.event.id, staffId: w.member1.id });
    const board = await getReviewBoard(db, w.leader, w.event.id);
    expect(board.teams[0]?.members.find((m) => m.staffId === w.member1.id)?.review?.isCompleted).toBe(true);
  });
});
