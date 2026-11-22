import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { assignmentTables, eventStaffAssignments, tableGroups } from "@/db/schema";
import { assignTeamToGroup, saveTableGroups } from "@/features/staffing/groups-service";
import { saveTeams } from "@/features/staffing/teams-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent, snapshot, sorted, tablesOfGroup } from "./helpers";

describe("saveTableGroups (spec §13.10: bir masa tek gruba ait)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("grupları ve masalarını oluşturur", async () => {
    const { actor, event, tables } = await setupEvent();
    const [t1, t2, t3] = tables;
    const r = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "G1", tableIds: [t1!.id, t2!.id] },
        { name: "G2", tableIds: [t3!.id] },
      ],
    });
    const g1 = r.groups.find((g) => g.name === "G1")!;
    expect(await tablesOfGroup(g1.id)).toEqual(sorted([t1!.id, t2!.id]));
  });

  it("aynı masa iki grupta: conflict ve hiçbir değişiklik olmaz", async () => {
    const { actor, event, tables } = await setupEvent();
    const [t1, t2] = tables;
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "Eski", tableIds: [t2!.id] }] });
    const before = await snapshot(event.id);
    const err = await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [
          { name: "G1", tableIds: [t1!.id] },
          { name: "G2", tableIds: [t1!.id, t2!.id] },
        ],
      }),
      "conflict",
    );
    expect(err.message).toContain("tek gruba");
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("masa taşıma atomik: grup kimlikleri korunur, masa yalnızca yeni gruptadır", async () => {
    const { actor, event, tables } = await setupEvent();
    const [t1, t2, t3] = tables;
    const first = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "A", tableIds: [t1!.id, t2!.id] },
        { name: "B", tableIds: [t3!.id] },
      ],
    });
    const a = first.groups.find((g) => g.name === "A")!;
    const b = first.groups.find((g) => g.name === "B")!;
    const second = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { id: a.id, name: "A", tableIds: [t1!.id] },
        { id: b.id, name: "B", tableIds: [t2!.id, t3!.id] },
      ],
    });
    expect(second.groups.map((g) => g.id).sort()).toEqual(sorted([a.id, b.id]));
    expect(await tablesOfGroup(a.id)).toEqual([t1!.id]);
    expect(await tablesOfGroup(b.id)).toEqual(sorted([t2!.id, t3!.id]));
  });

  it("grup güncellemesi ekip bağını korur; listeden çıkan grup silinir", async () => {
    const { actor, event, tables } = await setupEvent();
    const teamsRes = await saveTeams(db, actor, { eventId: event.id, teams: [{ name: "T", members: [] }] });
    const teamId = teamsRes.teams[0]!.id;
    const first = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "A", teamId, tableIds: [tables[0]!.id] },
        { name: "B", tableIds: [] },
      ],
    });
    const a = first.groups.find((g) => g.name === "A")!;
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ id: a.id, name: "A2", teamId, tableIds: [tables[0]!.id, tables[1]!.id] }],
    });
    const rows = await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: a.id, name: "A2", teamId });
  });

  it("başka etkinliğin masası conflict, önceki durum kalır", async () => {
    const { actor, event, tables } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreignTable = await f.createTable(db, other.id);
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "A", tableIds: [tables[0]!.id] }] });
    const before = await snapshot(event.id);
    await expectDomain(
      saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "X", tableIds: [foreignTable.id] }] }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("başka etkinliğin ekibi gruba bağlanamaz", async () => {
    const { actor, event } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreign = await saveTeams(db, actor, { eventId: other.id, teams: [{ name: "Y", members: [] }] });
    await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [{ name: "A", teamId: foreign.teams[0]!.id, tableIds: [] }],
      }),
      "conflict",
    );
  });

  it("eşzamanlı iki kayıt (ayrı bağlantılar) etkinlik kilidiyle sıralanır: ikinci, birincinin sonucunu görür", async () => {
    const { actor, event, tables } = await setupEvent();
    const [t1, t2] = tables;
    let second: Promise<unknown> | undefined;
    let secondSettled = false;
    // Birinci kayıt kendi bağlantısında açık transaction içinde; kilit commit'e kadar tutulur.
    await db.transaction(async (tx) => {
      await saveTableGroups(tx, actor, { eventId: event.id, groups: [{ name: "P", tableIds: [t1!.id, t2!.id] }] });
      second = saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "Q", tableIds: [t1!.id] }] }).finally(
        () => {
          secondSettled = true;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(secondSettled).toBe(false);
    });
    // Kilit olmasaydı ikinci kayıt eski (boş) durumdan fark hesaplar, T1 tekilliğinde 23505 ile düşerdi.
    await expect(second).resolves.toBeDefined();
    const rows = await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id));
    expect(rows.map((r) => r.name)).toEqual(["Q"]);
    expect(await tablesOfGroup(rows[0]!.id)).toEqual([t1!.id]);
  });
});

describe("assignTeamToGroup", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("grubu ekibe bağlar ve gruptaki masaların atamalarına ekibi yazar", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const teamsRes = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [{ name: "T", color: "#112233", members: [] }],
    });
    const teamId = teamsRes.teams[0]!.id;
    const groups = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "G", tableIds: [tables[0]!.id] }],
    });
    const groupId = groups.groups[0]!.id;
    const inGroup = await f.createAssignment(db, { eventId: event.id, staffId: people[0]!.id });
    const outside = await f.createAssignment(db, { eventId: event.id, staffId: people[1]!.id });
    await db.insert(assignmentTables).values([
      { eventId: event.id, assignmentId: inGroup.id, tableId: tables[0]!.id },
      { eventId: event.id, assignmentId: outside.id, tableId: tables[1]!.id },
    ]);

    await assignTeamToGroup(db, actor, { eventId: event.id, groupId, teamId });

    const [g] = await db.select().from(tableGroups).where(eq(tableGroups.id, groupId));
    expect(g).toMatchObject({ teamId, color: "#112233" });
    const [a1] = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.id, inGroup.id));
    const [a2] = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.id, outside.id));
    expect(a1?.teamId).toBe(teamId);
    expect(a2?.teamId).toBeNull();
  });

  it("ekip bağını kaldırır (teamId null)", async () => {
    const { actor, event } = await setupEvent();
    const teamsRes = await saveTeams(db, actor, { eventId: event.id, teams: [{ name: "T", members: [] }] });
    const group = await f.createTableGroup(db, event.id, { teamId: teamsRes.teams[0]!.id });
    await assignTeamToGroup(db, actor, { eventId: event.id, groupId: group.id, teamId: null });
    const [g] = await db.select().from(tableGroups).where(eq(tableGroups.id, group.id));
    expect(g?.teamId).toBeNull();
  });

  it("başka etkinliğin grubu not_found, başka etkinliğin ekibi conflict", async () => {
    const { actor, event } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreignGroup = await f.createTableGroup(db, other.id);
    const foreignTeam = await saveTeams(db, actor, { eventId: other.id, teams: [{ name: "Y", members: [] }] });
    const group = await f.createTableGroup(db, event.id);
    await expectDomain(
      assignTeamToGroup(db, actor, { eventId: event.id, groupId: foreignGroup.id, teamId: null }),
      "not_found",
    );
    await expectDomain(
      assignTeamToGroup(db, actor, { eventId: event.id, groupId: group.id, teamId: foreignTeam.teams[0]!.id }),
      "conflict",
    );
  });
});
