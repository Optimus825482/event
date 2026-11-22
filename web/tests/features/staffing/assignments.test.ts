import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, servicePoints, staff } from "@/db/schema";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { saveTeams } from "@/features/staffing/teams-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent, snapshot, sorted, tablesOfAssignment } from "./helpers";

async function createServicePoint(eventId: string) {
  const [row] = await db.insert(servicePoints).values({ eventId, name: "Bar 1" }).returning();
  if (!row) throw new Error("servis noktası eklenemedi");
  return row;
}

async function assignmentsOf(eventId: string) {
  return db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, eventId));
}

describe("saveAssignments (masa + özel görev + servis noktası tek transaction)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("üç atama türünü masalarıyla birlikte kaydeder", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const point = await createServicePoint(event.id);
    const r = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id, tables[1]!.id] },
        {
          staffId: people[1]!.id,
          assignmentType: "special_task",
          specialTaskLocation: "Vestiyer",
          specialTaskStartTime: "19:00",
          specialTaskEndTime: "23:00",
          tableIds: [],
        },
        { staffId: people[2]!.id, assignmentType: "service_point", servicePointId: point.id, tableIds: [] },
      ],
    });
    expect(r.assignments).toHaveLength(3);
    const tableAssignment = r.assignments.find((a) => a.staffId === people[0]!.id)!;
    expect(await tablesOfAssignment(tableAssignment.id)).toEqual(sorted([tables[0]!.id, tables[1]!.id]));
    const special = (await assignmentsOf(event.id)).find((a) => a.assignmentType === "special_task");
    expect(special).toMatchObject({ specialTaskLocation: "Vestiyer", specialTaskStartTime: "19:00:00" });
  });

  it("yalnızca masa atamaları kaydedilirken özel görev ve servis noktası atamaları kaybolmaz", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const point = await createServicePoint(event.id);
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[1]!.id, assignmentType: "special_task", specialTaskLocation: "Giriş", tableIds: [] },
        { staffId: people[2]!.id, assignmentType: "service_point", servicePointId: point.id, tableIds: [] },
      ],
    });
    const keptBefore = (await assignmentsOf(event.id)).filter((a) => a.assignmentType !== "table");

    await saveAssignments(db, actor, {
      eventId: event.id,
      types: ["table"],
      assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[1]!.id] }],
    });

    const after = await assignmentsOf(event.id);
    const keptAfter = after.filter((a) => a.assignmentType !== "table");
    expect(keptAfter.map((a) => a.id).sort()).toEqual(keptBefore.map((a) => a.id).sort());
    expect(after.filter((a) => a.assignmentType === "table")).toHaveLength(1);
  });

  it("tam kayıtta gönderilen özel görev kimliğiyle korunur (eski sistem masasız atamayı atlıyordu)", async () => {
    const { actor, event, people } = await setupEvent();
    const first = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, assignmentType: "special_task", specialTaskLocation: "Kapı", tableIds: [] }],
    });
    const id = first.assignments[0]!.id;
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { id, staffId: people[0]!.id, assignmentType: "special_task", specialTaskLocation: "Kapı 2", tableIds: [] },
      ],
    });
    const rows = await assignmentsOf(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, specialTaskLocation: "Kapı 2", assignmentType: "special_task" });
  });

  it("güncellemede kimlik korunur, masa farkı uygulanır; listeden çıkan atama silinir", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const first = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id, tables[1]!.id] },
        { staffId: people[1]!.id, assignmentType: "table", tableIds: [tables[2]!.id] },
      ],
    });
    const keep = first.assignments.find((a) => a.staffId === people[0]!.id)!;
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ id: keep.id, staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[1]!.id, tables[3]!.id] }],
    });
    const rows = await assignmentsOf(event.id);
    expect(rows.map((r) => r.id)).toEqual([keep.id]);
    expect(await tablesOfAssignment(keep.id)).toEqual(sorted([tables[1]!.id, tables[3]!.id]));
  });

  it("aynı personel aynı vardiyaya iki kez atanamaz: conflict, toplu kayıt ortasında hata → hiçbir değişiklik yok", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const shift = await f.createShift(db);
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[2]!.id, assignmentType: "special_task", specialTaskLocation: "Depo", tableIds: [] }],
    });
    const before = await snapshot(event.id);
    const err = await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [
          { staffId: people[1]!.id, shiftId: shift.id, assignmentType: "table", tableIds: [tables[0]!.id] },
          { staffId: people[0]!.id, shiftId: shift.id, assignmentType: "table", tableIds: [tables[1]!.id] },
          { staffId: people[0]!.id, shiftId: shift.id, assignmentType: "special_task", tableIds: [] },
        ],
      }),
      "conflict",
    );
    expect(err.message).toContain("iki kez");
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("korunan türdeki mevcut satırla çakışma da conflict (veritabanı tekilliği) ve geri alınır", async () => {
    const { actor, event, tables, people } = await setupEvent();
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, assignmentType: "special_task", tableIds: [] }],
    });
    const before = await snapshot(event.id);
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        types: ["table"],
        assignments: [
          { staffId: people[1]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
          { staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[1]!.id] },
        ],
      }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("aynı personelin iki atamasının vardiyaları yer değiştirebilir; kimlikler korunur", async () => {
    const { actor, event, people } = await setupEvent();
    const s1 = await f.createShift(db);
    const s2 = await f.createShift(db);
    const first = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, shiftId: s1.id, assignmentType: "table", role: "garson", tableIds: [] },
        { staffId: people[0]!.id, shiftId: s2.id, assignmentType: "special_task", tableIds: [] },
      ],
    });
    const a = first.assignments.find((x) => x.shiftId === s1.id)!;
    const b = first.assignments.find((x) => x.shiftId === s2.id)!;
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { id: a.id, staffId: people[0]!.id, shiftId: s2.id, assignmentType: "table", role: "garson", tableIds: [] },
        { id: b.id, staffId: people[0]!.id, shiftId: s1.id, assignmentType: "special_task", tableIds: [] },
      ],
    });
    const rows = await assignmentsOf(event.id);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ shiftId: s2.id, role: "garson" });
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ shiftId: s1.id });
  });

  it("başka etkinliğin masası, vardiyası ve ekibi conflict", async () => {
    const { actor, event, people } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreignTable = await f.createTable(db, other.id);
    const foreignShift = await f.createShift(db, { eventId: other.id });
    const foreignTeam = await saveTeams(db, actor, { eventId: other.id, teams: [{ name: "Z", members: [] }] });
    const staffId = people[0]!.id;
    await expectDomain(
      saveAssignments(db, actor, { eventId: event.id, assignments: [{ staffId, assignmentType: "table", tableIds: [foreignTable.id] }] }),
      "conflict",
    );
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId, shiftId: foreignShift.id, assignmentType: "table", tableIds: [] }],
      }),
      "conflict",
    );
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId, teamId: foreignTeam.teams[0]!.id, assignmentType: "table", tableIds: [] }],
      }),
      "conflict",
    );
    expect(await assignmentsOf(event.id)).toHaveLength(0);
  });

  it("özel görev masa alamaz; servis noktası ataması servis noktası ister", async () => {
    const { actor, event, tables, people } = await setupEvent();
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, assignmentType: "special_task", tableIds: [tables[0]!.id] }],
      }),
      "conflict",
    );
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, assignmentType: "service_point", tableIds: [] }],
      }),
      "conflict",
    );
  });

  it("başka etkinliğin atama kimliği conflict", async () => {
    const { actor, event, people } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreign = await f.createAssignment(db, { eventId: other.id, staffId: people[0]!.id });
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ id: foreign.id, staffId: people[0]!.id, assignmentType: "table", tableIds: [] }],
      }),
      "conflict",
    );
  });
  it("pasif personel atanamaz (otomatik atamayla aynı kural); satır yazılmaz", async () => {
    const { actor, event, tables, people } = await setupEvent();
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, people[0]!.id));
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] }],
      }),
      "conflict",
    );
    expect(await assignmentsOf(event.id)).toHaveLength(0);
  });

  it("sonradan pasife alınan personelin değişmeyen ataması yeniden kaydedilebilir", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const first = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] }],
    });
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, people[0]!.id));
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { id: first.assignments[0]!.id, staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id], notes: "x" },
      ],
    });
    expect((await assignmentsOf(event.id))[0]?.notes).toBe("x");
  });

  it("bir masa tek ekip: grubun ekibinden farklı ekip conflict, aynı ekip ve boş ekip kabul", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const teamsRes = await saveTeams(db, actor, {
      eventId: event.id,
      teams: [
        { name: "A", members: [] },
        { name: "B", members: [] },
      ],
    });
    const teamA = teamsRes.teams.find((t) => t.name === "A")!.id;
    const teamB = teamsRes.teams.find((t) => t.name === "B")!.id;
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "G", teamId: teamA, tableIds: [tables[0]!.id] }],
    });
    await expectDomain(
      saveAssignments(db, actor, {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, teamId: teamB, assignmentType: "table", tableIds: [tables[0]!.id] }],
      }),
      "conflict",
    );
    expect(await assignmentsOf(event.id)).toHaveLength(0);
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, teamId: teamA, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[1]!.id, assignmentType: "table", tableIds: [tables[0]!.id] },
        { staffId: people[2]!.id, teamId: teamB, assignmentType: "table", tableIds: [tables[1]!.id] },
      ],
    });
    expect(await assignmentsOf(event.id)).toHaveLength(3);
  });
});
