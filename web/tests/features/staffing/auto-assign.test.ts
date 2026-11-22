import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { assignmentTables, eventStaffAssignments } from "@/db/schema";
import { autoAssign, saveAssignments } from "@/features/staffing/assignments-service";
import { planAutoAssign, type PlannableTable } from "@/features/staffing/auto-assign";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent, snapshot, sorted, tablesOfAssignment } from "./helpers";

function table(id: string, x: number, y = 0, isLoca = false): PlannableTable {
  return { id, label: id, x, y, isLoca };
}

const TABLES = [table("M1", 50), table("M2", 10), table("M3", 40), table("M4", 20), table("M5", 30)];

describe("planAutoAssign (saf)", () => {
  it("balanced: etikete göre sıralı, paylar en çok 1 farklı", () => {
    const plan = planAutoAssign(TABLES, ["a", "b"], "balanced");
    expect(plan).toEqual([
      { staffId: "a", tableIds: ["M1", "M2", "M3"] },
      { staffId: "b", tableIds: ["M4", "M5"] },
    ]);
    const four = planAutoAssign(TABLES, ["a", "b", "c", "d"], "balanced");
    expect(four.map((p) => p.tableIds.length)).toEqual([2, 1, 1, 1]);
  });

  it("etiketler doğal sırayla sıralanır (M2 < M10)", () => {
    const plan = planAutoAssign([table("M10", 0), table("M2", 0)], ["a", "b"], "balanced");
    expect(plan.map((p) => p.tableIds[0])).toEqual(["M2", "M10"]);
  });

  it("zone: x (sonra y) koordinatına göre bölgeler", () => {
    const plan = planAutoAssign(TABLES, ["a", "b"], "zone");
    expect(plan).toEqual([
      { staffId: "a", tableIds: ["M2", "M4", "M5"] },
      { staffId: "b", tableIds: ["M3", "M1"] },
    ]);
  });

  it("random: aynı tohumla aynı sonuç; her masa tam bir kez dağıtılır", () => {
    const one = planAutoAssign(TABLES, ["a", "b"], "random", 42);
    const two = planAutoAssign(TABLES, ["a", "b"], "random", 42);
    expect(one).toEqual(two);
    expect(one.flatMap((p) => p.tableIds).sort()).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(planAutoAssign(TABLES, ["a", "b"], "random", s)));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("localar hiçbir stratejide dağıtılmaz", () => {
    const withLoca = [...TABLES, table("L1", 0, 0, true), table("L2", 99, 0, true)];
    for (const strategy of ["balanced", "zone", "random"] as const) {
      const ids = planAutoAssign(withLoca, ["a", "b", "c"], strategy, 7).flatMap((p) => p.tableIds);
      expect(ids.sort()).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    }
  });

  it("masadan çok personel: fazlası boş liste alır", () => {
    const plan = planAutoAssign([table("M1", 0)], ["a", "b"], "balanced");
    expect(plan).toEqual([
      { staffId: "a", tableIds: ["M1"] },
      { staffId: "b", tableIds: [] },
    ]);
  });
});

describe("autoAssign (kalıcı, atomik)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masa atamalarını yazar, locaları dışarıda bırakır, özel görevlere dokunmaz", async () => {
    const { actor, event, tables, people } = await setupEvent({ tableCount: 4, staffCount: 3 });
    const loca = await f.createTable(db, event.id, { label: "LOCA-1", isLoca: true });
    const special = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[2]!.id, assignmentType: "special_task", specialTaskLocation: "Kapı", tableIds: [] }],
    });

    const r = await autoAssign(db, actor, {
      eventId: event.id,
      staffIds: [people[0]!.id, people[1]!.id],
      strategy: "balanced",
    });

    expect(r.plan.flatMap((p) => p.tableIds)).not.toContain(loca.id);
    const linked = await db.select().from(assignmentTables).where(eq(assignmentTables.eventId, event.id));
    expect(linked.map((l) => l.tableId).sort()).toEqual(sorted(tables.map((t) => t.id)));
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows.find((x) => x.id === special.assignments[0]!.id)).toMatchObject({ specialTaskLocation: "Kapı" });
    expect(rows).toHaveLength(3);
  });

  it("aynı personelin mevcut masa ataması kimliğini korur, masaları değişir", async () => {
    const { actor, event, tables, people } = await setupEvent({ tableCount: 2, staffCount: 1 });
    const first = await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[0]!.id, assignmentType: "table", tableIds: [tables[0]!.id] }],
    });
    await autoAssign(db, actor, { eventId: event.id, staffIds: [people[0]!.id], strategy: "zone" });
    expect(await tablesOfAssignment(first.assignments[0]!.id)).toEqual(sorted(tables.map((t) => t.id)));
  });

  it("random tohumla tekrarlanabilir", async () => {
    const { actor, event, people } = await setupEvent({ tableCount: 6, staffCount: 2 });
    const input = { eventId: event.id, staffIds: people.map((p) => p.id), strategy: "random" as const, seed: 99 };
    const a = await autoAssign(db, actor, input);
    const b = await autoAssign(db, actor, input);
    expect(a.plan).toEqual(b.plan);
  });

  it("çakışmada (personelin aynı vardiyada özel görevi var) hiçbir atama yazılmaz", async () => {
    const { actor, event, people } = await setupEvent({ tableCount: 4, staffCount: 2 });
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [{ staffId: people[1]!.id, assignmentType: "special_task", tableIds: [] }],
    });
    const before = await snapshot(event.id);
    await expectDomain(
      autoAssign(db, actor, { eventId: event.id, staffIds: [people[0]!.id, people[1]!.id], strategy: "balanced" }),
      "conflict",
    );
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("aktif olmayan personel conflict", async () => {
    const { actor, event } = await setupEvent({ tableCount: 2, staffCount: 0 });
    const passive = await f.createStaff(db, { status: "inactive" });
    await expectDomain(autoAssign(db, actor, { eventId: event.id, staffIds: [passive.id], strategy: "balanced" }), "conflict");
  });
});
