import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, tableGroups } from "@/db/schema";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { assignTeamToGroup, saveTableGroups } from "@/features/staffing/groups-service";
import { saveTeams } from "@/features/staffing/teams-service";
import { truncateAll } from "../../helpers/db";
import { expectDomain, setupEvent, snapshot } from "./helpers";

async function groupsOf(eventId: string) {
  return db.select().from(tableGroups).where(eq(tableGroups.eventId, eventId));
}

/** Etkinlik + iki ekip (A, B) + 4 masa + 3 personel. */
async function setup() {
  const ctx = await setupEvent({ tableCount: 4, staffCount: 3 });
  const res = await saveTeams(db, ctx.actor, {
    eventId: ctx.event.id,
    teams: [
      { name: "A", members: [] },
      { name: "B", members: [] },
    ],
  });
  const teamA = res.teams.find((t) => t.name === "A")!.id;
  const teamB = res.teams.find((t) => t.name === "B")!.id;
  return { ...ctx, teamA, teamB };
}

describe("spec §13.10: bir masa tek ekibe aittir, her yazmada korunur", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ekipsiz atama ekipli grubun masasına konabilir (ikinci bir ekip oluşturmaz)", async () => {
    const { actor, event, tables, people, teamA } = await setup();
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "G", teamId: teamA, tableIds: [tables[0]!.id] }] });
    // Spec §13.10: "Bir masa, etkinlik içinde tek gruba ve tek ekibe aittir; her yazmada korunur."
    // Ekipsiz (teamId boş) atama masaya ikinci bir ekip getirmez: masanın ekibi grubundaki ekip olarak kalır.
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] }],
    });
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.teamId).toBeNull();
  });

  it("grupsuz masaya iki farklı ekibin ataması yazılamaz; ekipsiz olan eşlik edebilir", async () => {
    const { actor, event, tables, people, teamA, teamB } = await setup();
    const before = await snapshot(event.id);
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [
          { staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] },
          { staffId: people[1]!.id, teamId: teamB, assignmentType: "table", tableIds: [tables[0]!.id, tables[1]!.id] },
        ],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[1]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[2]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
      ],
    });
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows).toHaveLength(3);
  });

  it("grubun ekibi, masalardaki atamaların ekibiyle çelişecekse grup kaydı reddedilir ve geri alınır", async () => {
    const { actor, event, tables, people, teamA, teamB } = await setup();
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "G", teamId: teamA, tableIds: [tables[0]!.id] }] });
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] }],
    });
    const before = await snapshot(event.id);
    const [group] = await groupsOf(event.id);

    await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [{ id: group!.id, name: "G", teamId: teamB, tableIds: [tables[0]!.id] }],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("masa başka ekibin grubuna taşınırsa ve masadaki atamanın ekibiyle çelişirse reddedilir", async () => {
    const { actor, event, tables, people, teamA, teamB } = await setup();
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "GA", teamId: teamA, tableIds: [tables[0]!.id] },
        { name: "GB", teamId: teamB, tableIds: [tables[1]!.id] },
      ],
    });
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] }],
    });
    const before = await snapshot(event.id);
    const groups = await groupsOf(event.id);
    const ga = groups.find((g) => g.name === "GA")!;
    const gb = groups.find((g) => g.name === "GB")!;
    await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [
          { id: ga.id, name: "GA", teamId: teamA, tableIds: [] },
          { id: gb.id, name: "GB", teamId: teamB, tableIds: [tables[1]!.id, tables[0]!.id] },
        ],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("ekipsiz atama grup ekibi değişse de engel olmaz; assignTeamToGroup grubun atamalarını yeniden ekipler", async () => {
    const { actor, event, tables, people, teamA, teamB } = await setup();
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "G", teamId: teamA, tableIds: [tables[0]!.id] }] });
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[1]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
      ],
    });
    const [group] = await groupsOf(event.id);
    await assignTeamToGroup(db, actor, { eventId: event.id, groupId: group!.id, teamId: teamB });
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows.every((r) => r.teamId === teamB)).toBe(true);
  });
});
