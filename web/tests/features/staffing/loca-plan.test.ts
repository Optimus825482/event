import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { tableGroups } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { groupUngroupedLocas, listLocaStaffing } from "@/features/staffing/loca-plan";
import { managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { assignStaffToTables } from "../../helpers/fnb";
import { makeActor } from "./helpers";

async function setup() {
  const actor = await makeActor();
  const event = await f.createEvent(db, { organizerId: actor.id });
  const l1 = await f.createTable(db, event.id, { label: "L1", x: 0, y: 0, isLoca: true, sortNumber: 2, floor: 2 });
  const l2 = await f.createTable(db, event.id, { label: "L2", x: 10, y: 0, isLoca: true, sortNumber: 1 });
  const l3 = await f.createTable(db, event.id, { label: "L3", x: 20, y: 0, isLoca: true });
  await f.createTable(db, event.id, { label: "A1", x: 30, y: 0 });
  return { actor, event, l1, l2, l3 };
}

describe("loca personel planı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("listLocaStaffing loca masalarını grup, süpervizör ve atanan personelle döner", async () => {
    const { actor, event, l1, l2, l3 } = await setup();
    const sup = await f.createStaff(db, { fullName: "Süper Vizör" });
    const person = await f.createStaff(db, { fullName: "Ayşe Garson" });
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "Loca Grubu", groupType: "loca", supervisorStaffId: sup.id, tableIds: [l1.id] }],
    });
    await assignStaffToTables(db, { eventId: event.id, staffId: person.id, tableIds: [l1.id] });

    const rows = await listLocaStaffing(db, actor, event.id);
    expect(rows.map((r) => r.label)).toEqual(["L2", "L1", "L3"]);
    const first = rows.find((r) => r.tableId === l1.id)!;
    expect(first).toMatchObject({ floor: 2, groupName: "Loca Grubu", supervisorStaffId: sup.id });
    expect(first.staff).toEqual([{ staffId: person.id, fullName: "Ayşe Garson", role: null }]);
    expect(rows.find((r) => r.tableId === l2.id)).toMatchObject({
      groupId: null,
      groupName: null,
      supervisorStaffId: null,
      staff: [],
    });
    expect(rows.find((r) => r.tableId === l3.id)?.staff).toEqual([]);
  });

  it("groupUngroupedLocas yalnızca grupsuzları gruplar ve ad çakışmasını çözer", async () => {
    const { actor, event, l3 } = await setup();
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "Loca L1", groupType: "standard", tableIds: [] },
        { name: "Ayrı", groupType: "loca", tableIds: [l3.id] },
      ],
    });
    expect(await groupUngroupedLocas(db, actor, { eventId: event.id })).toEqual({ created: 2 });
    const rows = await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id));
    expect(rows.map((r) => r.name).sort()).toEqual(["Ayrı", "Loca L1", "Loca L1 (2)", "Loca L2"]);
    expect(rows.filter((r) => r.groupType === "loca")).toHaveLength(3);
    expect(await groupUngroupedLocas(db, actor, { eventId: event.id })).toEqual({ created: 0 });
  });

  it("Casino yöneticisi loca planını göremez", async () => {
    const { event } = await setup();
    const casino = await makeActor(managerActor("casino"));
    await expect(listLocaStaffing(db, casino, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(groupUngroupedLocas(db, casino, { eventId: event.id })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
