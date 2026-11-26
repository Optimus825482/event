import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staff, tableGroups } from "@/db/schema";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent } from "./helpers";

const supervisorOf = async (eventId: string) => {
  const rows = await db.select().from(tableGroups).where(eq(tableGroups.eventId, eventId));
  return rows.map((r) => r.supervisorStaffId);
};

describe("grup süpervizörü (sunucu)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("süpervizör kaydedilir, değiştirilir ve null ile kaldırılır", async () => {
    const { actor, event, people } = await setupEvent();
    const [a, b] = people;
    const saved = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "G1", supervisorStaffId: a!.id, tableIds: [] }],
    });
    const groupId = saved.groups[0]!.id;
    expect(await supervisorOf(event.id)).toEqual([a!.id]);

    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ id: groupId, name: "G1", supervisorStaffId: b!.id, tableIds: [] }],
    });
    expect(await supervisorOf(event.id)).toEqual([b!.id]);

    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ id: groupId, name: "G1", supervisorStaffId: null, tableIds: [] }],
    });
    expect(await supervisorOf(event.id)).toEqual([null]);
  });

  it("aynı kişi birden çok grubun süpervizörü olabilir; etkinliğe atanmış olması gerekmez", async () => {
    const { actor, event, people } = await setupEvent();
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [
        { name: "G1", supervisorStaffId: people[0]!.id, tableIds: [] },
        { name: "G2", supervisorStaffId: people[0]!.id, tableIds: [] },
      ],
    });
    expect(await supervisorOf(event.id)).toEqual([people[0]!.id, people[0]!.id]);
  });

  it("var olmayan personel süpervizör olamaz", async () => {
    const { actor, event } = await setupEvent();
    const err = await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [{ name: "G1", supervisorStaffId: "00000000-0000-4000-8000-000000000000", tableIds: [] }],
      }),
      "conflict",
    );
    expect(err.message).toBe("Süpervizör etkin bir personel olmalı");
    expect(await supervisorOf(event.id)).toEqual([]);
  });

  it("etkin olmayan personel yeni süpervizör olarak reddedilir", async () => {
    const { actor, event } = await setupEvent();
    const gone = await f.createStaff(db, { status: "inactive" });
    await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [{ name: "G1", supervisorStaffId: gone.id, tableIds: [] }],
      }),
      "conflict",
    );
  });

  it("süpervizör sonradan pasif olsa da diğer değişiklikler kaydedilir; değişmeyen atama korunur", async () => {
    const { actor, event, people } = await setupEvent();
    const saved = await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "G1", supervisorStaffId: people[0]!.id, tableIds: [] }],
    });
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, people[0]!.id));
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ id: saved.groups[0]!.id, name: "G1 yeni", supervisorStaffId: people[0]!.id, tableIds: [] }],
    });
    expect(await supervisorOf(event.id)).toEqual([people[0]!.id]);
  });
});
