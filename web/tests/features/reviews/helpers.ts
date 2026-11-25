import { expect } from "vitest";
import { db } from "@/db/client";
import { teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { ForbiddenError } from "@/features/auth/errors";
import { adminActor, managerActor, memberActor, persistActor } from "../../helpers/actors";
import * as f from "../../helpers/factories";

/** Aktörü veritabanına yazar: departman aktörü ya da `"admin"`. */
export async function makeActor(who: Actor | "admin", staffId?: string | null): Promise<Actor> {
  return persistActor(db, who === "admin" ? adminActor({ staffId: staffId ?? null }) : who);
}

/** Ekip lideri: F&B kullanıcı düzeyi; yalnızca kendi ekibini görür (`ownTeamOnly`). */
export async function makeLeader(staffId: string | null = null): Promise<Actor> {
  return persistActor(db, memberActor("fnb", { reviews: "vce-", check_in: "vc--", notifications: "v---" }, { staffId }));
}

export async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found" | "invalid") {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  return err as DomainError;
}

export async function expectForbidden(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ForbiddenError);
}

export const FULL_RATINGS = {
  communication: 5,
  punctuality: 4,
  teamwork: 4,
  customerService: 5,
  technicalSkills: 3,
  initiative: 3,
  appearance: 5,
  stressManagement: 4,
};

/**
 * Etkinlik (değerlendirme açık) + lider (kullanıcı + personel) + liderin ekibi + iki üye;
 * ayrıca başka liderin ekibi ve üyesi.
 */
export async function setupReviewWorld(opts: { reviewEnabled?: boolean } = {}) {
  const fnbManager = await makeActor(managerActor("fnb"));
  const event = await f.createEvent(db, {
    organizerId: fnbManager.id,
    reviewEnabled: opts.reviewEnabled ?? true,
  });

  const leaderStaff = await f.createStaff(db, { fullName: "Lider Bir" });
  const leader = await makeLeader(leaderStaff.id);
  const otherLeaderStaff = await f.createStaff(db, { fullName: "Lider İki" });
  const otherLeader = await makeLeader(otherLeaderStaff.id);

  const [team] = await db
    .insert(teams)
    .values({ eventId: event.id, name: "A Ekibi", leaderStaffId: leaderStaff.id })
    .returning();
  const [otherTeam] = await db
    .insert(teams)
    .values({ eventId: event.id, name: "B Ekibi", leaderStaffId: otherLeaderStaff.id })
    .returning();
  if (!team || !otherTeam) throw new Error("ekip eklenemedi");

  const member1 = await f.createStaff(db, { fullName: "Üye Bir" });
  const member2 = await f.createStaff(db, { fullName: "Üye İki" });
  const otherMember = await f.createStaff(db, { fullName: "Başka Üye" });
  await db.insert(teamMembers).values([
    { teamId: team.id, staffId: leaderStaff.id, isLeader: true },
    { teamId: team.id, staffId: member1.id },
    { teamId: team.id, staffId: member2.id },
    { teamId: otherTeam.id, staffId: otherLeaderStaff.id, isLeader: true },
    { teamId: otherTeam.id, staffId: otherMember.id },
  ]);

  const admin = await makeActor(adminActor());
  return { fnbManager, event, leader, leaderStaff, otherLeader, team, otherTeam, member1, member2, otherMember, admin };
}
