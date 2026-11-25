import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventSectionHeads, eventStaffAssignments, staffPerformanceReviews, tableGroups, tableGroupTables } from "@/db/schema";
import { scopedMembers, scopedTeams } from "@/features/reviews/leader-scope";
import { REVIEW_MESSAGES } from "@/features/reviews/labels";
import { getReviewBoard, listReviewableEvents, type ReviewBoard } from "@/features/reviews/queries";
import { completeAllReviews, completeReview, saveReviewDraft } from "@/features/reviews/service";
import { managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { addTeamMember, assignStaffToTables, createSectionHead, createShortReview, createTeam } from "../../helpers/fnb";
import { FULL_RATINGS, expectDomain, expectForbidden, makeActor, makeLeader } from "./helpers";

const lists = { strengths: [], improvements: [], recommendedTrainings: [] };

/**
 * Etkinlik E (değerlendirme açık): ekip T (lider C; üyeler W1, W2); masa grubu G (süpervizör S, ekip T,
 * masalar A1, A2); W3 ekipsiz, A1'e atanmış; kısım sorumlusu H.
 */
async function setupWorld() {
  const manager = await makeActor(managerActor("fnb"));
  const event = await f.createEvent(db, { organizerId: manager.id, reviewEnabled: true });

  const C = await f.createStaff(db, { fullName: "Kaptan C" });
  const W1 = await f.createStaff(db, { fullName: "Garson W1" });
  const W2 = await f.createStaff(db, { fullName: "Garson W2" });
  const S = await f.createStaff(db, { fullName: "Süpervizör S" });
  const W3 = await f.createStaff(db, { fullName: "Garson W3" });
  const H = await f.createStaff(db, { fullName: "Kısım H" });

  const T = await createTeam(db, { eventId: event.id, leaderStaffId: C.id, name: "T" });
  await addTeamMember(db, T.id, W1.id);
  await addTeamMember(db, T.id, W2.id);

  const A1 = await f.createTable(db, event.id, { label: "A1" });
  const A2 = await f.createTable(db, event.id, { label: "A2" });
  const G = await f.createTableGroup(db, event.id, { name: "G", supervisorStaffId: S.id, teamId: T.id });
  await db.insert(tableGroupTables).values([
    { eventId: event.id, tableGroupId: G.id, tableId: A1.id },
    { eventId: event.id, tableGroupId: G.id, tableId: A2.id },
  ]);
  const { assignmentId: w3Assignment } = await assignStaffToTables(db, {
    eventId: event.id,
    staffId: W3.id,
    tableIds: [A1.id],
  });
  await createSectionHead(db, { eventId: event.id, staffId: H.id });

  const actors = {
    C: await makeLeader(C.id),
    S: await makeLeader(S.id),
    H: await makeLeader(H.id),
  };
  return { manager, event, C, W1, W2, S, W3, H, T, G, w3Assignment, actors };
}

type World = Awaited<ReturnType<typeof setupWorld>>;

function boardIndex(board: ReviewBoard) {
  return board.teams.flatMap((t) => t.members.map((m) => ({ team: t.name, teamId: t.id, ...m })));
}

async function rowOf(w: World, staffId: string, reviewerId: string) {
  const [row] = await db
    .select()
    .from(staffPerformanceReviews)
    .where(
      and(
        eq(staffPerformanceReviews.eventId, w.event.id),
        eq(staffPerformanceReviews.staffId, staffId),
        eq(staffPerformanceReviews.reviewerId, reviewerId),
      ),
    );
  return row;
}

describe("hiyerarşik değerlendirme akışları", () => {
  let w: World;

  beforeEach(async () => {
    await truncateAll();
    w = await setupWorld();
  });

  it("süpervizör grubundaki ekipsiz personeli kaydeder ve tamamlar", async () => {
    await saveReviewDraft(db, w.actors.S, { ...lists, eventId: w.event.id, staffId: w.W3.id, ratings: FULL_RATINGS });
    const { review } = await completeReview(db, w.actors.S, { eventId: w.event.id, staffId: w.W3.id });
    expect(review.isCompleted).toBe(true);
  });

  it("kaptan ekipsiz personeli değerlendiremez", async () => {
    await expectForbidden(
      saveReviewDraft(db, w.actors.C, { ...lists, eventId: w.event.id, staffId: w.W3.id, ratings: FULL_RATINGS }),
    );
    expect(await rowOf(w, w.W3.id, w.actors.C.id)).toBeUndefined();
  });

  it("kısım sorumlusu panoda herkesi görür, kendini görmez; ekipsiz personel 'Ekip dışı personel' altında", async () => {
    const board = await getReviewBoard(db, w.actors.H, w.event.id);
    const all = boardIndex(board);
    expect(all.map((m) => m.staffId).sort()).toEqual([w.C.id, w.W1.id, w.W2.id, w.S.id, w.W3.id].sort());
    expect(all.find((m) => m.staffId === w.H.id)).toBeUndefined();
    expect(board.teams.map((t) => t.name)).toEqual(["T", "Ekip dışı personel"]);
    const outside = board.teams[1];
    expect(outside).toMatchObject({ id: "ekip-disi", name: "Ekip dışı personel", color: "#64748b" });
    expect(outside?.members.map((m) => m.staffId).sort()).toEqual([w.S.id, w.W3.id].sort());
    expect(all.find((m) => m.staffId === w.W3.id)?.bases).toEqual(["section_head"]);
    // Kaptan kendi ekibinin lideri olarak ekibin altında görünür.
    expect(all.find((m) => m.staffId === w.C.id)?.team).toBe("T");

    const [listed] = await listReviewableEvents(db, w.actors.H);
    expect(listed).toMatchObject({ id: w.event.id, teamCount: 2, memberCount: 5, completedCount: 0 });
  });

  it("iki dayanaklı değerlendirici tek satır üretir ve panoda personel bir kez görünür", async () => {
    await db.update(tableGroups).set({ supervisorStaffId: w.C.id }).where(eq(tableGroups.id, w.G.id));
    // W1 ikinci bir ekipte de: panoda yalnızca ilk ekipte (sortOrder, ad) görünür.
    const T9 = await createTeam(db, { eventId: w.event.id, name: "Z Ekibi" });
    await addTeamMember(db, T9.id, w.W1.id);

    const input = { ...lists, eventId: w.event.id, staffId: w.W1.id, ratings: FULL_RATINGS };
    await saveReviewDraft(db, w.actors.C, input);
    await saveReviewDraft(db, w.actors.C, { ...input, ratings: { ...FULL_RATINGS, communication: 1 } });
    const rows = await db
      .select()
      .from(staffPerformanceReviews)
      .where(and(eq(staffPerformanceReviews.eventId, w.event.id), eq(staffPerformanceReviews.staffId, w.W1.id)));
    expect(rows).toHaveLength(1);

    const all = boardIndex(await getReviewBoard(db, w.actors.C, w.event.id));
    const w1 = all.filter((m) => m.staffId === w.W1.id);
    expect(w1).toHaveLength(1);
    expect(w1[0]).toMatchObject({ team: "T", bases: ["captain", "supervisor"] });
    expect(w1[0]?.review?.ratings.communication).toBe(1);
    expect(all.find((m) => m.staffId === w.C.id)).toBeUndefined();
  });

  it("kısım sorumluluğu kaldırılınca sonraki istekte erişim biter", async () => {
    const input = { ...lists, eventId: w.event.id, staffId: w.W1.id, ratings: FULL_RATINGS };
    await saveReviewDraft(db, w.actors.H, input);
    await db.delete(eventSectionHeads).where(eq(eventSectionHeads.staffId, w.H.id));
    await expectForbidden(saveReviewDraft(db, w.actors.H, input));
    await expectForbidden(completeReview(db, w.actors.H, { eventId: w.event.id, staffId: w.W1.id }));
    await expectForbidden(getReviewBoard(db, w.actors.H, w.event.id));
    expect(await listReviewableEvents(db, w.actors.H)).toEqual([]);
  });

  it("tümünü tamamla yetkisi kalkan taslağı atlar", async () => {
    await saveReviewDraft(db, w.actors.S, { ...lists, eventId: w.event.id, staffId: w.W3.id, ratings: FULL_RATINGS });
    await saveReviewDraft(db, w.actors.S, { ...lists, eventId: w.event.id, staffId: w.W1.id, ratings: FULL_RATINGS });
    await db.delete(eventStaffAssignments).where(eq(eventStaffAssignments.id, w.w3Assignment));

    const res = await completeAllReviews(db, w.actors.S, { eventId: w.event.id });
    expect(res).toMatchObject({ completed: 1, incomplete: 0, skipped: 1 });
    expect((await rowOf(w, w.W3.id, w.actors.S.id))?.isCompleted).toBe(false);
    expect((await rowOf(w, w.W1.id, w.actors.S.id))?.isCompleted).toBe(true);
  });

  it("kısa taslak puansızken tamamlanamaz, puanlıyken tamamlanır", async () => {
    const draft = await createShortReview(db, {
      eventId: w.event.id,
      staffId: w.W3.id,
      reviewerId: w.actors.S.id,
      overallRating: null,
      isCompleted: false,
    });
    const err = await expectDomain(completeReview(db, w.actors.S, { eventId: w.event.id, staffId: w.W3.id }), "invalid");
    expect(err.message).toBe(REVIEW_MESSAGES.incomplete);

    await db
      .update(staffPerformanceReviews)
      .set({ overallRating: 4, score: 80 })
      .where(eq(staffPerformanceReviews.id, draft.id));
    const { review } = await completeReview(db, w.actors.S, { eventId: w.event.id, staffId: w.W3.id });
    expect(review.isCompleted).toBe(true);

    // Toplu tamamlama da aynı kuralı izler.
    await createShortReview(db, {
      eventId: w.event.id,
      staffId: w.W1.id,
      reviewerId: w.actors.S.id,
      overallRating: null,
      isCompleted: false,
    });
    await createShortReview(db, {
      eventId: w.event.id,
      staffId: w.W2.id,
      reviewerId: w.actors.S.id,
      overallRating: 5,
      isCompleted: false,
    });
    expect(await completeAllReviews(db, w.actors.S, { eventId: w.event.id })).toMatchObject({
      completed: 1,
      incomplete: 1,
      skipped: 0,
    });
  });

  it("eski ayrıntılı satır panoda aynen görünür", async () => {
    await db.insert(staffPerformanceReviews).values({
      staffId: w.W1.id,
      eventId: w.event.id,
      reviewerId: w.actors.C.id,
      score: 77,
      rating: "good",
      ...FULL_RATINGS,
      isCompleted: true,
    });
    const member = boardIndex(await getReviewBoard(db, w.actors.C, w.event.id)).find((m) => m.staffId === w.W1.id);
    expect(member?.review).toMatchObject({ formKind: "full", overallRating: null, score: 77, isCompleted: true });
    expect(member?.review?.ratings).toEqual(FULL_RATINGS);
  });

  it("bildirim bağlantısı yeni rotadadır", async () => {
    await saveReviewDraft(db, w.actors.C, { ...lists, eventId: w.event.id, staffId: w.W1.id, ratings: FULL_RATINGS });
    await saveReviewDraft(db, w.actors.C, { ...lists, eventId: w.event.id, staffId: w.W2.id, ratings: FULL_RATINGS });
    const { notification } = await completeReview(db, w.actors.C, { eventId: w.event.id, staffId: w.W1.id });
    expect(notification.actionUrl).toBe(`/fnb/team/reviews/${w.event.id}`);
    const all = await completeAllReviews(db, w.actors.C, { eventId: w.event.id });
    expect(all.notification?.actionUrl).toBe(`/fnb/team/reviews/${w.event.id}`);
  });

  it("staffId'siz F&B kullanıcısı hiçbir ekip görmez", async () => {
    // Kapı staffId'siz kullanıcıyı baştan eler: hiçbir ekip dönmez (kapalı başarısızlık).
    await expectForbidden(scopedTeams(db, await makeLeader(null)));
  });

  it("ekip kapsamı: yalnızca değerlendirilebilir personeli içeren ekipler ve yalnızca o üyeler", async () => {
    const Q = await createTeam(db, { eventId: w.event.id, name: "Q" });
    const W5 = await f.createStaff(db, { fullName: "Garson W5" });
    await addTeamMember(db, Q.id, W5.id);

    const forC = await scopedTeams(db, w.actors.C);
    expect(forC.map((t) => t.name)).toEqual(["T"]);
    expect((await scopedMembers(db, forC)).map((m) => m.fullName)).toEqual(["Garson W1", "Garson W2"]);

    const forS = await scopedTeams(db, w.actors.S);
    expect(forS.map((t) => t.name)).toEqual(["T"]);
    // Süpervizör kaptanı da değerlendirir: lider ekibin altında listelenir.
    expect((await scopedMembers(db, forS)).map((m) => m.fullName)).toEqual(["Garson W1", "Garson W2", "Kaptan C"]);

    const forH = await scopedTeams(db, w.actors.H);
    expect(forH.map((t) => t.name).sort()).toEqual(["Q", "T"]);
    // scopedTeams'ten gelmeyen ekip listesi hiçbir üye açmaz.
    expect(await scopedMembers(db, forH.map((t) => ({ ...t })))).toEqual([]);
  });
});
