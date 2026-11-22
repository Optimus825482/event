import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { closeRealtime } from "@/features/realtime/listener";
import { autoAssign, saveAssignments } from "@/features/staffing/assignments-service";
import { assignTeamToGroup, saveTableGroups } from "@/features/staffing/groups-service";
import { saveTeams } from "@/features/staffing/teams-service";
import { truncateAll } from "../../helpers/db";
import { watchEvents } from "../realtime/emitted";
import { setupEvent } from "./helpers";

describe("ekip/masa grubu/atama kayıtları gerçek zamanlı olaylar", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("saveTableGroups: table.updated; çifte grup hatasında hiçbiri", async () => {
    const { actor, event, tables } = await setupEvent();
    const t1 = tables[0]!.id;
    const watch = await watchEvents(event.id);
    try {
      await expect(
        saveTableGroups(db, actor, {
          eventId: event.id,
          groups: [
            { name: "G1", tableIds: [t1] },
            { name: "G2", tableIds: [t1] },
          ],
        }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "G1", tableIds: [t1] }] });
      expect(await watch.settled()).toEqual(["table.updated"]);
    } finally {
      watch.stop();
    }
  });

  it("assignTeamToGroup: table.updated; olmayan grupta hiçbiri", async () => {
    const { actor, event, tables } = await setupEvent();
    const team = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [{ name: "T", color: "#112233", members: [] }],
    });
    const teamId = team.teams[0]!.id;
    const saved = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "G", tableIds: [tables[0]!.id] }],
    });
    const groupId = saved.groups[0]!.id;
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      await expect(
        assignTeamToGroup(db, actor, { eventId: event.id, groupId: "00000000-0000-4000-8000-000000000000", teamId }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await assignTeamToGroup(db, actor, { eventId: event.id, groupId, teamId });
      expect(await watch.settled()).toEqual(["table.updated"]);
    } finally {
      watch.stop();
    }
  });

  it("saveAssignments ve autoAssign: table.updated; geçersiz kayıtta hiçbiri", async () => {
    const { actor, event, tables, people } = await setupEvent({ tableCount: 4, staffCount: 2 });
    const watch = await watchEvents(event.id);
    try {
      await expect(
        saveAssignments(db, actor, {
          eventId: event.id,
          assignments: [
            { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
            { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[1]!.id] },
          ],
        }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] }],
      });
      expect(await watch.settled()).toEqual(["table.updated"]);

      await autoAssign(db, actor, { eventId: event.id, staffIds: people.map((p) => p.id), strategy: "balanced" });
      expect(await watch.settled()).toEqual(["table.updated", "table.updated"]);
    } finally {
      watch.stop();
    }
  });
});
