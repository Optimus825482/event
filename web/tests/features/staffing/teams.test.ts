import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, events, tableGroups, teamMembers, teams } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { saveTeams } from "@/features/staffing/teams-service";
import { adminActor, noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, makeActor, setupEvent, snapshot, makeLegacy } from "./helpers";

describe("saveTeams", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yeni ekipleri ve üyelerini oluşturur", async () => {
    const { actor, event, people } = await setupEvent();
    const [p1, p2] = people;
    const result = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [
        {
          name: "Kırmızı",
          color: "#ff0000",
          leaderStaffId: p1!.id,
          members: [{ staffId: p1!.id, isLeader: true }, { staffId: p2!.id }],
        },
      ],
    });
    expect(result.teams).toHaveLength(1);
    const rows = await db.select().from(teams).where(eq(teams.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Kırmızı", color: "#ff0000", leaderStaffId: p1!.id });
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, rows[0]!.id));
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.staffId === p1!.id)?.isLeader).toBe(true);
  });

  it("güncellemede ekip kimliği korunur; table_groups.team_id bağı kopmaz", async () => {
    const { actor, event, people } = await setupEvent();
    const first = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [{ name: "A", members: [{ staffId: people[0]!.id }] }, { name: "B", members: [] }],
    });
    const teamA = first.teams.find((t) => t.name === "A")!;
    const group = await f.createTableGroup(db, event.id, { teamId: teamA.id });

    const second = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [
        { id: teamA.id, name: "A yeni", members: [{ staffId: people[1]!.id }] },
        { name: "C", members: [] },
      ],
    });

    expect(second.teams.find((t) => t.name === "A yeni")?.id).toBe(teamA.id);
    const [g] = await db.select().from(tableGroups).where(eq(tableGroups.id, group.id));
    expect(g?.teamId).toBe(teamA.id);
    const names = (await db.select().from(teams).where(eq(teams.eventId, event.id))).map((t) => t.name).sort();
    expect(names).toEqual(["A yeni", "C"]);
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamA.id));
    expect(members.map((m) => m.staffId)).toEqual([people[1]!.id]);
  });

  it("üyelik satırları da kimliğini korur (değişmeyen üye silinip eklenmez)", async () => {
    const { actor, event, people } = await setupEvent();
    const r = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [{ name: "A", members: [{ staffId: people[0]!.id }] }],
    });
    const teamId = r.teams[0]!.id;
    const [before] = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    await saveTeams(db, actor, {
      eventId: event.id,
      teams: [{ id: teamId, name: "A", members: [{ staffId: people[0]!.id, role: "kaptan" }, { staffId: people[1]!.id }] }],
    });
    const after = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    const same = after.find((m) => m.staffId === people[0]!.id);
    expect(same?.id).toBe(before!.id);
    expect(same?.role).toBe("kaptan");
  });

  it("listeden çıkan ekip silinir; grubun ve atamanın ekip bağı boşalır", async () => {
    const { actor, event, people } = await setupEvent();
    const r = await saveTeams(db, actor, { eventId: event.id, teams: [{ name: "A", members: [] }] });
    const teamId = r.teams[0]!.id;
    const group = await f.createTableGroup(db, event.id, { teamId });
    const assignment = await f.createAssignment(db, { eventId: event.id, staffId: people[0]!.id, teamId });

    await saveTeams(db, actor, { eventId: event.id, teams: [] });

    expect(await db.select().from(teams).where(eq(teams.eventId, event.id))).toHaveLength(0);
    const [g] = await db.select().from(tableGroups).where(eq(tableGroups.id, group.id));
    expect(g?.teamId).toBeNull();
    const [a] = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.id, assignment.id));
    expect(a?.teamId).toBeNull();
  });

  it("başka etkinliğin ekip kimliği conflict, hiçbir şey değişmez", async () => {
    const { actor, event } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreign = await saveTeams(db, actor, { eventId: other.id, teams: [{ name: "X", members: [] }] });
    await saveTeams(db, actor, { eventId: event.id, teams: [{ name: "Mevcut", members: [] }] });
    const before = await snapshot(event.id);

    await expectDomain(
      saveTeams(db, actor, { eventId: event.id, teams: [{ id: foreign.teams[0]!.id, name: "Çal", members: [] }] }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
    const [x] = await db.select().from(teams).where(eq(teams.id, foreign.teams[0]!.id));
    expect(x?.name).toBe("X");
  });

  it("olmayan personel üyeliği conflict ve önceki durum kalır", async () => {
    const { actor, event, people } = await setupEvent();
    await saveTeams(db, actor, { eventId: event.id, teams: [{ name: "A", members: [{ staffId: people[0]!.id }] }] });
    const before = await snapshot(event.id);
    await expectDomain(
      saveTeams(db, actor, {
        eventId: event.id,
        teams: [{ name: "B", members: [{ staffId: crypto.randomUUID() }] }],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("başka organizatörün etkinliği not_found", async () => {
    const { event } = await setupEvent();
    const stranger = await makeLegacy("organizer");
    await expectDomain(saveTeams(db, stranger, { eventId: event.id, teams: [] }), "not_found");
  });

  it("admin başkasının etkinliğinde çalışır", async () => {
    const { event } = await setupEvent();
    const admin = await makeActor(adminActor());
    const r = await saveTeams(db, admin, { eventId: event.id, teams: [{ name: "A", members: [] }] });
    expect(r.teams).toHaveLength(1);
  });

  it("tamamlanmış ya da iptal edilmiş etkinlikte değişiklik yapılamaz", async () => {
    const { actor, event } = await setupEvent();
    for (const status of ["completed", "cancelled"] as const) {
      await db.update(events).set({ status }).where(eq(events.id, event.id));
      await expectDomain(saveTeams(db, actor, { eventId: event.id, teams: [] }), "conflict");
    }
  });

  it("staff rolü forbidden", async () => {
    const { event } = await setupEvent();
    const actor = await makeActor(noAccessActor());
    await expect(saveTeams(db, actor, { eventId: event.id, teams: [] })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
