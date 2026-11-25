import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { assignmentTables, staffPerformanceReviews, tableGroupTables } from "@/db/schema";
import {
  getLeaderDashboard,
  getLeaderEventDetail,
  getLeaderReport,
  getMemberPerformance,
  listLeaderEvents,
  listLeaderTeams,
} from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";
import { memberActor, noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { FULL_RATINGS, expectDomain, expectForbidden, makeActor, setupReviewWorld, makeLeader, makeLegacy } from "./helpers";

async function completedReview(w: Awaited<ReturnType<typeof setupReviewWorld>>, staffId: string, score: number) {
  await db.insert(staffPerformanceReviews).values({
    staffId,
    reviewerId: w.leader.id,
    eventId: w.event.id,
    score,
    rating: "good",
    ...FULL_RATINGS,
    isCompleted: true,
  });
}

describe("lider paneli: kapsam", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("lider yalnızca kendi ekibini ve üyelerini görür", async () => {
    const w = await setupReviewWorld();
    const teams = await listLeaderTeams(db, w.leader);
    expect(teams.map((t) => t.name)).toEqual(["A Ekibi"]);
    // Lider kendini üye listesinde görmez.
    expect(teams[0]?.members.map((m) => m.fullName).sort()).toEqual(["Üye Bir", "Üye İki"]);

    const other = await listLeaderTeams(db, w.otherLeader);
    expect(other.map((t) => t.name)).toEqual(["B Ekibi"]);
  });

  it("panel özeti yalnızca kendi sayılarını verir", async () => {
    const w = await setupReviewWorld();
    const d = await getLeaderDashboard(db, w.leader, new Date("2027-01-01T00:00:00Z"));
    expect(d).toMatchObject({ teamCount: 1, memberCount: 2, eventCount: 1, pendingReviewEvents: 1 });
    expect(d.next?.id).toBe(w.event.id);
    expect(d.countdown).toEqual({ days: 9, hours: 18 });
  });

  it("etkinlik listesi süzgeci ad ve duruma göre çalışır", async () => {
    const w = await setupReviewWorld();
    expect(await listLeaderEvents(db, w.leader, { search: "zzz" })).toHaveLength(0);
    expect(await listLeaderEvents(db, w.leader, { status: "active" })).toHaveLength(0);
    expect(await listLeaderEvents(db, w.leader, { status: "draft" })).toHaveLength(1);
  });

  it("başkasının etkinliği ve üyesi not_found; olmayan kayıt da aynı", async () => {
    const w = await setupReviewWorld();
    const foreignEvent = await f.createEvent(db, { organizerId: w.organizer.id });
    await expectDomain(getLeaderEventDetail(db, w.leader, foreignEvent.id), "not_found");
    await expectDomain(getMemberPerformance(db, w.leader, w.otherMember.id), "not_found");
    await expectDomain(getMemberPerformance(db, w.leader, w.leaderStaff.id), "not_found");
    await expectDomain(getMemberPerformance(db, w.leader, "11111111-1111-4111-8111-111111111111"), "not_found");
  });

  it("başka liderin ekibinin etkinliği, ekibi olmayan lider için not_found", async () => {
    const w = await setupReviewWorld();
    const loneStaff = await f.createStaff(db);
    const lone = await makeLeader(loneStaff.id);
    await expectDomain(getLeaderEventDetail(db, lone, w.event.id), "not_found");
    expect(await listLeaderTeams(db, lone)).toEqual([]);
  });

  it("rol kapısı: personel ve kontrolör reddedilir; bağlı personeli olmayan lider panel kullanamaz", async () => {
    const w = await setupReviewWorld();
    await expectForbidden(getLeaderDashboard(db, await makeActor(noAccessActor())));
    await expectForbidden(listLeaderTeams(db, await makeActor(memberActor("casino", { check_in: "vc--" }))));
    const unlinked = await makeLeader();
    expect(canUseLeaderPanel(unlinked)).toBe(false);
    expect(canUseLeaderPanel(w.leader)).toBe(true);
    await expectForbidden(getLeaderReport(db, unlinked));
  });

  it("organizatör başkasının etkinliğinin ekiplerini görmez", async () => {
    const w = await setupReviewWorld();
    const stranger = await makeLegacy("organizer");
    expect(await listLeaderTeams(db, stranger)).toEqual([]);
    await expectDomain(getLeaderEventDetail(db, stranger, w.event.id), "not_found");
    expect((await listLeaderTeams(db, w.organizer)).length).toBe(2);
  });
});

describe("lider paneli: etkinlik ayrıntısı, performans, rapor", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("atanan masalar ekip grubu ve üye atamalarından birleşir; misafir sayısı yalnızca bu masalardan", async () => {
    const w = await setupReviewWorld();
    const t1 = await f.createTable(db, w.event.id, { label: "A1" });
    const t2 = await f.createTable(db, w.event.id, { label: "A2" });
    const t3 = await f.createTable(db, w.event.id, { label: "B1" });
    const group = await f.createTableGroup(db, w.event.id, { teamId: w.team.id });
    await db.insert(tableGroupTables).values({ eventId: w.event.id, tableGroupId: group.id, tableId: t1.id });
    const assignment = await f.createAssignment(db, { eventId: w.event.id, staffId: w.member1.id, teamId: w.team.id });
    await db.insert(assignmentTables).values({ eventId: w.event.id, assignmentId: assignment.id, tableId: t2.id });
    const otherAssignment = await f.createAssignment(db, { eventId: w.event.id, staffId: w.otherMember.id });
    await db.insert(assignmentTables).values({ eventId: w.event.id, assignmentId: otherAssignment.id, tableId: t3.id });

    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: w.event.id, tableId: t1.id, customerId: customer.id, guestCount: 4 });
    await f.createReservation(db, { eventId: w.event.id, tableId: t3.id, customerId: customer.id, guestCount: 9 });

    const detail = await getLeaderEventDetail(db, w.leader, w.event.id);
    expect([...detail.assignedTableIds].sort()).toEqual([t1.id, t2.id].sort());
    expect(detail.guestCount).toBe(4);
    expect(detail.tableLabels).toEqual({ [t1.id]: "A1", [t2.id]: "A2" });
    expect(detail.teams).toHaveLength(1);
    expect(detail.plan.tables.map((t) => t.label).sort()).toEqual(["A1", "A2", "B1"]);
  });

  it("performans yalnızca liderin kendi tamamladığı değerlendirmelerinden hesaplanır", async () => {
    const w = await setupReviewWorld();
    await completedReview(w, w.member1.id, 80);
    // Başka bir değerlendiricinin kaydı sayılmaz.
    await db.insert(staffPerformanceReviews).values({
      staffId: w.member1.id,
      reviewerId: w.admin.id,
      eventId: w.event.id,
      score: 10,
      rating: "bad",
      ...FULL_RATINGS,
      isCompleted: true,
    });
    const perf = await getMemberPerformance(db, w.leader, w.member1.id);
    expect(perf).toMatchObject({ reviewCount: 1, averageScore: 80, averageBand: "successful", trend: null });
    expect(perf.history[0]?.eventName).toBe(w.event.name);
    expect(perf.categories.communication).toBe(5);
  });

  it("rapor takım bazında üye, değerlendirilen ve ortalama verir", async () => {
    const w = await setupReviewWorld();
    await completedReview(w, w.member1.id, 70);
    const report = await getLeaderReport(db, w.leader, new Date("2027-01-01T00:00:00Z"));
    expect(report).toMatchObject({ teamCount: 1, memberCount: 2, reviewCount: 1, averageScore: 70, upcomingEventCount: 1 });
    expect(report.rows).toEqual([
      expect.objectContaining({ teamName: "A Ekibi", memberCount: 2, reviewedCount: 1, averageScore: 70 }),
    ]);
  });
});
