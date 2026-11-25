import {
  assignmentTables,
  eventSectionHeads,
  staffPerformanceReviews,
  teamMembers,
  teams,
} from "@/db/schema";
import { ratingBand } from "@/features/reviews/score";
import { createAssignment, type Executor } from "./factories";

export type TeamRow = typeof teams.$inferSelect;
export type ReviewRow = typeof staffPerformanceReviews.$inferSelect;

let teamSeq = 0;

export async function createTeam(
  ex: Executor,
  o: { eventId: string; leaderStaffId?: string | null; isActive?: boolean; name?: string },
): Promise<TeamRow> {
  teamSeq += 1;
  const [row] = await ex
    .insert(teams)
    .values({
      eventId: o.eventId,
      name: o.name ?? `Ekip ${teamSeq}`,
      leaderStaffId: o.leaderStaffId ?? null,
      isActive: o.isActive ?? true,
    })
    .returning();
  if (!row) throw new Error("ekip eklenemedi");
  return row;
}

export async function addTeamMember(ex: Executor, teamId: string, staffId: string): Promise<void> {
  await ex.insert(teamMembers).values({ teamId, staffId });
}

export async function createSectionHead(ex: Executor, o: { eventId: string; staffId: string }): Promise<void> {
  await ex.insert(eventSectionHeads).values({ eventId: o.eventId, staffId: o.staffId });
}

/** Personeli etkinlikte bir atamaya bağlar ve verilen masaları atar. */
export async function assignStaffToTables(
  ex: Executor,
  o: { eventId: string; staffId: string; tableIds: string[]; teamId?: string },
): Promise<{ assignmentId: string }> {
  const assignment = await createAssignment(ex, {
    eventId: o.eventId,
    staffId: o.staffId,
    ...(o.teamId ? { teamId: o.teamId } : {}),
  });
  if (o.tableIds.length > 0) {
    await ex
      .insert(assignmentTables)
      .values(o.tableIds.map((tableId) => ({ eventId: o.eventId, assignmentId: assignment.id, tableId })));
  }
  return { assignmentId: assignment.id };
}

/** Kısa formlu bir değerlendirme satırı yazar (puan = yıldız × 20; bant ratingBand ile). */
export async function createShortReview(
  ex: Executor,
  o: { eventId: string; staffId: string; reviewerId: string; overallRating: number | null; isCompleted?: boolean },
): Promise<ReviewRow> {
  const score = o.overallRating === null ? 0 : o.overallRating * 20;
  const [row] = await ex
    .insert(staffPerformanceReviews)
    .values({
      eventId: o.eventId,
      staffId: o.staffId,
      reviewerId: o.reviewerId,
      formKind: "short",
      overallRating: o.overallRating,
      isCompleted: o.isCompleted ?? true,
      score,
      rating: ratingBand(score),
    })
    .returning();
  if (!row) throw new Error("değerlendirme eklenemedi");
  return row;
}
