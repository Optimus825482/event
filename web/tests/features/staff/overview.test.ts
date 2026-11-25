import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departments, staffPerformanceReviews, teamMembers, teams } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { listStaffReviewHistory, listStaffReviewSummaries } from "@/features/reviews/staff-summary";
import { getStaffStats, listDepartmentCards } from "@/features/staff/overview-queries";
import { listTeamCards } from "@/features/staffing/team-cards";
import { adminActor, managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const admin = adminActor({ id: "u1" });
const doorOnly = memberActor("casino", { check_in: "vc--" }, { id: "u2" });
const fnbManager = managerActor("fnb", { id: "u3" });

describe("personel sayfası sorguları", () => {
  beforeEach(truncateAll);

  it("personel izni olmayan kullanıcı hiçbirini çalıştıramaz", async () => {
    await expect(getStaffStats(db, doorOnly)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listDepartmentCards(db, doorOnly)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listTeamCards(db, doorOnly)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listStaffReviewSummaries(db, doorOnly)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("istatistikler durum bazında sayar; bölüm kartları bölümsüzleri ayrı sayar", async () => {
    const [dep] = await db.insert(departments).values({ name: "Servis" }).returning();
    if (!dep) throw new Error("bölüm eklenemedi");
    await f.createStaff(db, { departmentId: dep.id });
    await f.createStaff(db, { departmentId: dep.id, status: "inactive" });
    await f.createStaff(db, { status: "terminated" });

    expect(await getStaffStats(db, admin)).toEqual({ total: 3, active: 1, inactive: 1, terminated: 1 });
    const cards = await listDepartmentCards(db, admin);
    expect(cards.find((c) => c.name === "Servis")).toMatchObject({ activeCount: 1, totalCount: 2 });
    expect(cards.find((c) => c.id === null)).toMatchObject({ name: "Bölümsüz", totalCount: 1, activeCount: 0 });
  });

  it("ekip kartları lider, üye sayısı ve etkinliği taşır; F&B yöneticisi kimin oluşturduğuna bakmadan görür", async () => {
    const creator = await f.createUser(db);
    const event = await f.createEvent(db, { organizerId: creator.id });
    const leader = await f.createStaff(db, { fullName: "Lider X" });
    const member = await f.createStaff(db);
    const [team] = await db
      .insert(teams)
      .values({ eventId: event.id, name: "Ekip 1", leaderStaffId: leader.id })
      .returning();
    if (!team) throw new Error("ekip eklenemedi");
    await db.insert(teamMembers).values([
      { teamId: team.id, staffId: leader.id, isLeader: true },
      { teamId: team.id, staffId: member.id },
    ]);
    await f.createAssignment(db, { eventId: event.id, staffId: member.id, teamId: team.id });

    const asAdmin = await listTeamCards(db, admin);
    expect(asAdmin).toEqual([
      expect.objectContaining({ name: "Ekip 1", leaderName: "Lider X", memberCount: 2, assignmentCount: 1, eventName: event.name }),
    ]);
    expect(await listTeamCards(db, fnbManager)).toHaveLength(1);
  });

  it("değerlendirme özeti yalnızca tamamlananları sayar; F&B yöneticisi kimin oluşturduğuna bakmadan görür", async () => {
    const creator = await f.createUser(db);
    const reviewer = await f.createUser(db);
    const event = await f.createEvent(db, { organizerId: creator.id });
    const person = await f.createStaff(db, { fullName: "Değerlendirilen" });
    const base = { staffId: person.id, reviewerId: reviewer.id, eventId: event.id, rating: "good" as const };
    await db.insert(staffPerformanceReviews).values({ ...base, score: 80, isCompleted: true });
    const other = await f.createEvent(db, { organizerId: creator.id });
    await db.insert(staffPerformanceReviews).values({ ...base, eventId: other.id, score: 60, isCompleted: false });

    const summary = await listStaffReviewSummaries(db, admin);
    expect(summary).toEqual([
      expect.objectContaining({ fullName: "Değerlendirilen", reviewCount: 1, averageScore: 80, band: "successful" }),
    ]);
    expect(await listStaffReviewSummaries(db, fnbManager)).toEqual(summary);
    const history = await listStaffReviewHistory(db, admin, person.id);
    expect(history.map((h) => h.score)).toEqual([80]);
  });
});
