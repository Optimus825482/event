import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventExtraStaff, eventExtraStaffGroups, eventExtraStaffTables, staff } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { staffingActionDefs } from "@/features/staffing/action-defs";
import { saveExtraStaff } from "@/features/staffing/extra-staff-service";
import { getOrganization, saveOrganization } from "@/features/staffing/organization-service";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, makeActor, setupEvent, snapshot, tablesOfGroup } from "./helpers";

describe("saveExtraStaff", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kadro dışı personeli masa ve gruplarıyla kaydeder; kimlik korunur", async () => {
    const { actor, event, tables } = await setupEvent();
    const groups = await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "G", tableIds: [] }] });
    const groupId = groups.groups[0]!.id;
    const first = await saveExtraStaff(db, actor, {
      eventId: event.id,
      extraStaff: [{ fullName: "Geçici Ali", tableIds: [tables[0]!.id], groupIds: [groupId] }],
    });
    const id = first.extraStaff[0]!.id;
    await saveExtraStaff(db, actor, {
      eventId: event.id,
      extraStaff: [{ id, fullName: "Geçici Ali Veli", tableIds: [tables[1]!.id], groupIds: [] }],
    });
    const [row] = await db.select().from(eventExtraStaff).where(eq(eventExtraStaff.id, id));
    expect(row?.fullName).toBe("Geçici Ali Veli");
    const tablesLinked = await db.select().from(eventExtraStaffTables).where(eq(eventExtraStaffTables.extraStaffId, id));
    expect(tablesLinked.map((t) => t.tableId)).toEqual([tables[1]!.id]);
    expect(await db.select().from(eventExtraStaffGroups).where(eq(eventExtraStaffGroups.extraStaffId, id))).toHaveLength(0);
  });

  it("başka etkinliğin masası conflict, hiçbir şey yazılmaz", async () => {
    const { actor, event } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreignTable = await f.createTable(db, other.id);
    await expectDomain(
      saveExtraStaff(db, actor, {
        eventId: event.id,
        extraStaff: [
          { fullName: "A", tableIds: [], groupIds: [] },
          { fullName: "B", tableIds: [foreignTable.id], groupIds: [] },
        ],
      }),
      "conflict",
    );
    expect(await db.select().from(eventExtraStaff).where(eq(eventExtraStaff.eventId, event.id))).toHaveLength(0);
  });
});

describe("saveOrganization (tüm sihirbaz tek transaction)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yeni ekip ve onu kullanan grup aynı kayıtta istemci kimliğiyle bağlanır", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const teamId = crypto.randomUUID();
    await saveOrganization(db, actor, {
      eventId: event.id,
      teams: [{ id: teamId, name: "T", members: [{ staffId: people[0]!.id }] }],
      groups: [{ name: "G", teamId, tableIds: [tables[0]!.id] }],
      assignments: [{ staffId: people[0]!.id, teamId, assignmentType: "table", tableIds: [tables[0]!.id] }],
      extraStaff: [],
    });
    const org = await getOrganization(db, actor, event.id);
    expect(org.teams.map((t) => t.id)).toEqual([teamId]);
    expect(org.groups[0]).toMatchObject({ teamId, tableIds: [tables[0]!.id] });
    expect(org.assignments[0]).toMatchObject({ teamId, tableIds: [tables[0]!.id] });
  });

  it("son adımda hata: ekip ve grup değişiklikleri de geri alınır", async () => {
    const { actor, event, tables, people } = await setupEvent();
    await saveOrganization(db, actor, {
      eventId: event.id,
      teams: [{ name: "Eski ekip", members: [] }],
      groups: [{ name: "Eski grup", tableIds: [tables[0]!.id] }],
      assignments: [{ staffId: people[1]!.id, assignmentType: "special_task", specialTaskLocation: "Kapı", tableIds: [] }],
      extraStaff: [],
    });
    const before = await snapshot(event.id);
    await expectDomain(
      saveOrganization(db, actor, {
        eventId: event.id,
        teams: [{ name: "Yeni ekip", members: [] }],
        groups: [{ name: "Yeni grup", tableIds: [tables[1]!.id] }],
        assignments: [
          { staffId: people[0]!.id, assignmentType: "table", tableIds: [] },
          { staffId: people[0]!.id, assignmentType: "table", tableIds: [] },
        ],
        extraStaff: [],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("getOrganization: etkinlik, masalar (loca bilgisiyle), aktif personel, vardiyalar", async () => {
    const { actor, event, people } = await setupEvent({ tableCount: 1, staffCount: 2 });
    await f.createTable(db, event.id, { label: "L1", isLoca: true });
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, people[1]!.id));
    const general = await f.createShift(db);
    const own = await f.createShift(db, { eventId: event.id });
    const other = await f.createEvent(db, { organizerId: actor.id });
    await f.createShift(db, { eventId: other.id });
    const org = await getOrganization(db, actor, event.id);
    expect(org.event.id).toBe(event.id);
    expect(org.tables.find((t) => t.label === "L1")?.isLoca).toBe(true);
    expect(org.staff.map((s) => s.id)).toEqual([people[0]!.id]);
    expect(org.shifts.map((s) => s.id).sort()).toEqual([general.id, own.id].sort());
  });

  it("getOrganization başkasının etkinliğinde not_found, staff rolü forbidden", async () => {
    const { event } = await setupEvent();
    await expectDomain(getOrganization(db, await makeActor("organizer"), event.id), "not_found");
    await expect(getOrganization(db, await makeActor("staff"), event.id)).rejects.toThrow();
  });
});

describe("staffing action'ları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  function actionsFor(actor: Actor | null) {
    const { defineAction } = createAction({ getActor: async () => actor });
    return {
      saveGroups: defineAction(staffingActionDefs.saveTableGroups),
      saveOrganization: defineAction(staffingActionDefs.saveOrganization),
    };
  }

  it("çakışma conflict koduyla Türkçe mesaj döner, geçersiz girdi alan hatası verir", async () => {
    const { actor, event, tables } = await setupEvent();
    const res = await actionsFor(actor).saveGroups({
      eventId: event.id,
      groups: [
        { name: "A", tableIds: [tables[0]!.id] },
        { name: "B", tableIds: [tables[0]!.id] },
      ],
    });
    expect(res).toMatchObject({ ok: false, code: "conflict" });
    if (!res.ok) expect(res.message).toContain("tek gruba");

    const invalid = await actionsFor(actor).saveGroups({ eventId: event.id, groups: [{ name: "", tableIds: [] }] });
    expect(invalid).toMatchObject({ ok: false, code: "invalid" });
    if (!invalid.ok) expect(invalid.fieldErrors?.["groups.0.name"]?.length).toBeGreaterThan(0);
  });

  it("staff rolü forbidden; organizatör kaydeder", async () => {
    const { actor, event, tables } = await setupEvent();
    const staffActor = await makeActor("staff");
    const payload = { eventId: event.id, groups: [{ name: "A", tableIds: [tables[0]!.id] }] };
    expect(await actionsFor(staffActor).saveGroups(payload)).toMatchObject({ ok: false, code: "forbidden" });
    const ok = await actionsFor(actor).saveGroups(payload);
    expect(ok.ok).toBe(true);
    const groupId = ok.ok ? ok.data.groups[0]!.id : "";
    expect(await tablesOfGroup(groupId)).toEqual([tables[0]!.id]);
  });
});
