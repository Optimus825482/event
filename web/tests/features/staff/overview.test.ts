import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departments, staffPerformanceReviews, teamMembers, teams } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { PolicyActor } from "@/features/auth/policy";
import { listStaffReviewHistory, listStaffReviewSummaries } from "@/features/reviews/staff-summary";
import { getStaffStats, listDepartmentCards } from "@/features/staff/overview-queries";
import { listTeamCards } from "@/features/staffing/team-cards";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const admin: PolicyActor = { id: "u1", role: "admin", staffId: null };
const controller: PolicyActor = { id: "u2", role: "controller", staffId: null };

describe("personel sayfası sorguları", () => {
  beforeEach(truncateAll);

  it("yetkisiz rol hiçbirini çalıştıramaz", async () => {
    await expect(getStaffStats(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listDepartmentCards(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listTeamCards(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listStaffReviewSummaries(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
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

  it("ekip kartları lider, üye sayısı ve etkinliği taşır; organizatör yalnızca kendi etkinliğini görür", async () => {
    const organizer = await f.createUser(db, { role: "organizer" });
    const stranger = await f.createUser(db, { role: "organizer" });
    const event = await f.createEvent(db, { organizerId: organizer.id });
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
    const own = await listTeamCards(db, { id: organizer.id, role: "organizer", staffId: null });
    expect(own).toHaveLength(1);
    const foreign = await listTeamCards(db, { id: stranger.id, role: "organizer", staffId: null });
    expect(foreign).toEqual([]);
  });

  it("değerlendirme özeti yalnızca tamamlananları sayar ve organizatörü kendi etkinliğiyle sınırlar", async () => {
    const organizer = await f.createUser(db, { role: "organizer" });
    const stranger = await f.createUser(db, { role: "organizer" });
    const reviewer = await f.createUser(db, { role: "leader" });
    const event = await f.createEvent(db, { organizerId: organizer.id });
    const person = await f.createStaff(db, { fullName: "Değerlendirilen" });
    const base = { staffId: person.id, reviewerId: reviewer.id, eventId: event.id, rating: "good" as const };
    await db.insert(staffPerformanceReviews).values({ ...base, score: 80, isCompleted: true });
    const other = await f.createEvent(db, { organizerId: organizer.id });
    await db.insert(staffPerformanceReviews).values({ ...base, eventId: other.id, score: 60, isCompleted: false });

    const summary = await listStaffReviewSummaries(db, admin);
    expect(summary).toEqual([
      expect.objectContaining({ fullName: "Değerlendirilen", reviewCount: 1, averageScore: 80, band: "successful" }),
    ]);
    expect(await listStaffReviewSummaries(db, { id: stranger.id, role: "organizer", staffId: null })).toEqual([]);
    const history = await listStaffReviewHistory(db, admin, person.id);
    expect(history.map((h) => h.score)).toEqual([80]);
  });
});
