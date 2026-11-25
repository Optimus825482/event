import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { visibleNavItems } from "@/features/auth/nav";
import { scopedTeams } from "@/features/reviews/leader-scope";
import { getReviewBoard, listReviewableEvents } from "@/features/reviews/queries";
import { completeAllReviews, saveReviewDraft } from "@/features/reviews/service";
import { assistantActor, managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { FULL_RATINGS, expectForbidden, makeActor, makeLeader, setupReviewWorld } from "./helpers";

const base = { strengths: [], improvements: [], recommendedTrainings: [] };

describe("F&B kullanıcısı yalnızca kendi ekibini görür (ownTeamOnly)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("staffId'si olan F&B kullanıcısı yalnızca lideri olduğu ekibi görür", async () => {
    const w = await setupReviewWorld();
    expect(w.leader.role).toBe("user");
    expect((await scopedTeams(db, w.leader)).map((t) => t.name)).toEqual(["A Ekibi"]);
    expect((await getReviewBoard(db, w.leader, w.event.id)).teams.map((t) => t.name)).toEqual(["A Ekibi"]);
    const [event] = await listReviewableEvents(db, w.leader);
    expect(event).toMatchObject({ teamCount: 1, memberCount: 2 });
  });

  it("staffId'si olmayan F&B kullanıcısı hiçbir ekibi görmez", async () => {
    const w = await setupReviewWorld();
    const noStaff = await makeLeader(null);
    // Kapı (authorizeReviewsGate) staffId'siz kullanıcıyı baştan eler: hiçbir ekip dönmez.
    await expectForbidden(scopedTeams(db, noStaff));
    await expectForbidden(listReviewableEvents(db, noStaff));
    await expectForbidden(getReviewBoard(db, noStaff, w.event.id));
  });

  it("F&B yöneticisi ve asistanı tüm ekipleri görür", async () => {
    const w = await setupReviewWorld();
    const assistant = await makeActor(assistantActor("fnb"));
    for (const actor of [w.fnbManager, assistant]) {
      expect(await scopedTeams(db, actor)).toHaveLength(2);
      expect((await getReviewBoard(db, actor, w.event.id)).teams).toHaveLength(2);
      const [event] = await listReviewableEvents(db, actor);
      expect(event?.teamCount).toBe(2);
    }
  });

  it("F&B kullanıcısı tümünü tamamlarken yalnızca kendi ekibinin taslaklarına dokunur", async () => {
    const w = await setupReviewWorld();
    await saveReviewDraft(db, w.leader, { ...base, eventId: w.event.id, staffId: w.member1.id, ratings: FULL_RATINGS });
    const res = await completeAllReviews(db, w.leader, { eventId: w.event.id });
    expect(res.completed).toBe(1);
  });

  it("staffId'si olmayan F&B kullanıcısı tümünü tamamlayamaz", async () => {
    const w = await setupReviewWorld();
    const noStaff = await makeLeader(null);
    await expectForbidden(completeAllReviews(db, noStaff, { eventId: w.event.id }));
  });

  it("menüde değerlendirme öğesi staffId'si olan kullanıcıya ve yöneticiye görünür, staffId'siz kullanıcıya görünmez", async () => {
    const w = await setupReviewWorld();
    const hasReviews = (a: Parameters<typeof visibleNavItems>[0]) =>
      visibleNavItems(a).some((i) => i.href === "/fnb/team/reviews");
    expect(hasReviews(w.leader)).toBe(true);
    expect(hasReviews(managerActor("fnb"))).toBe(true);
    expect(hasReviews(await makeLeader(null))).toBe(false);
  });
});
