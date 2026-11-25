import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { assignmentTables, eventStaffAssignments, events, tableGroupTables, tableGroups } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { importAssignments, previewAssignmentImport } from "@/features/import/assignments-import";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { managerActor, memberActor } from "../../helpers/actors";
import { actorOf, expectDomain, xlsx, type Cell } from "./helpers";

const HEADER: Cell[] = ["Sicil no", "Personel adı", "Masa etiketleri", "Grup", "Vardiya", "Görev"];

async function setup() {
  const owner = await actorOf(managerActor("fnb"));
  const event = await f.createEvent(db, { organizerId: owner.id });
  const tables: Record<string, Awaited<ReturnType<typeof f.createTable>>> = {};
  for (const label of ["T1", "T2", "T3", "T4"]) tables[label] = await f.createTable(db, event.id, { label });
  const ali = await f.createStaff(db, { sicilNo: "S-001", fullName: "Ali Yılmaz" });
  const veli = await f.createStaff(db, { sicilNo: "S-002", fullName: "Veli Kaya" });
  const ayse = await f.createStaff(db, { sicilNo: "S-003", fullName: "Ayşe Demir" });
  return { owner, event, tables, ali, veli, ayse };
}

async function snapshot(eventId: string) {
  const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, eventId));
  const links = await db.select().from(assignmentTables).where(eq(assignmentTables.eventId, eventId));
  return {
    rows: rows.map((r) => ({ id: r.id, staffId: r.staffId, shiftId: r.shiftId, role: r.role, type: r.assignmentType })).sort((a, b) => a.id.localeCompare(b.id)),
    links: links.map((l) => `${l.assignmentId}:${l.tableId}`).sort(),
  };
}

async function tablesOf(eventId: string, staffId: string): Promise<string[]> {
  const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, eventId));
  const mine = rows.filter((r) => r.staffId === staffId).map((r) => r.id);
  const links = await db.select().from(assignmentTables).where(eq(assignmentTables.eventId, eventId));
  return links.filter((l) => mine.includes(l.assignmentId)).map((l) => l.tableId).sort();
}

describe("personel atama içe aktarma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sicil no ile personeli, etiketle masaları, adla vardiyayı çözer ve tek seferde yazar", async () => {
    const { owner, event, tables, ali, veli } = await setup();
    const shift = await f.createShift(db, { name: "Akşam" });
    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([
        HEADER,
        ["S-001", null, "T1, T2", null, "akşam", "Garson"],
        [null, "Veli Kaya", "T3;T4", null, null, null],
      ]),
    });
    expect(result.written).toBe(true);
    expect(result.rows.map((r) => r.status)).toEqual(["created", "created"]);
    expect(await tablesOf(event.id, ali.id)).toEqual([tables.T1!.id, tables.T2!.id].sort());
    expect(await tablesOf(event.id, veli.id)).toEqual([tables.T3!.id, tables.T4!.id].sort());
    const saved = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.staffId, ali.id));
    expect(saved[0]).toMatchObject({ shiftId: shift.id, role: "Garson", assignmentType: "table" });
  });

  it("bir hatalı satır varsa hiçbir şey yazılmaz; hatalar yazmadan önce raporlanır", async () => {
    const { owner, event } = await setup();
    const before = await snapshot(event.id);
    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["S-001", null, "T1", null, null, null], ["S-002", null, "T9", null, null, null], ["S-003", null, "T2", null, null, null]]),
    });
    expect(result.written).toBe(false);
    expect(result.rows.map((r) => [r.row, r.status])).toEqual([[2, "skipped"], [3, "skipped"], [4, "skipped"]]);
    expect(result.rows[1]?.message).toBe('Masa bulunamadı: "T9"');
    expect(result.rows[0]?.message).toMatch(/yazılmadı/);
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("belirsiz personel adı satır hatasıdır; benzersiz ad (büyük/küçük harf, aksan farkıyla) eşleşir", async () => {
    const { owner, event, ayse } = await setup();
    await f.createStaff(db, { sicilNo: "S-010", fullName: "Mehmet Can" });
    await f.createStaff(db, { sicilNo: "S-011", fullName: "mehmet can" });
    const bytes = await xlsx([HEADER, [null, "Mehmet Can", "T1", null, null, null], [null, "AYŞE DEMİR", "T2", null, null, null]]);
    const preview = await previewAssignmentImport(db, owner, { eventId: event.id, bytes });
    expect(preview.rows.map((r) => r.status)).toEqual(["error", "ok"]);
    expect(preview.rows[0]?.message).toMatch(/birden fazla personel/);

    const result = await importAssignments(db, owner, { eventId: event.id, bytes });
    expect(result.written).toBe(false);
    expect(await tablesOf(event.id, ayse.id)).toEqual([]);
  });

  it("bulunamayan sicil no ada düşmez; pasif personel ve bilinmeyen vardiya hata verir", async () => {
    const { owner, event } = await setup();
    await f.createStaff(db, { sicilNo: "S-020", fullName: "Pasif Kişi", status: "inactive" });
    const preview = await previewAssignmentImport(db, owner, {
      eventId: event.id,
      bytes: await xlsx([
        HEADER,
        ["S-999", "Ali Yılmaz", "T1", null, null, null],
        ["S-020", null, "T1", null, null, null],
        ["S-001", null, "T1", null, "Gece", null],
      ]),
    });
    expect(preview.rows.map((r) => r.status)).toEqual(["error", "error", "error"]);
    expect(preview.rows[0]?.message).toBe('Sicil no bulunamadı: "S-999"');
    expect(preview.rows[1]?.message).toBe("Personel aktif değil");
    expect(preview.rows[2]?.message).toBe('Vardiya bulunamadı: "Gece"');
  });

  it("grup sütunu grubun masalarına açılır; masa etiketiyle birleşir", async () => {
    const { owner, event, tables, ali } = await setup();
    const [group] = await db.insert(tableGroups).values({ eventId: event.id, name: "Salon A" }).returning();
    if (!group) throw new Error("grup yok");
    await db.insert(tableGroupTables).values([
      { eventId: event.id, tableGroupId: group.id, tableId: tables.T1!.id },
      { eventId: event.id, tableGroupId: group.id, tableId: tables.T2!.id },
    ]);
    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["S-001", null, "T4", "salon a", null, null]]),
    });
    expect(result.written).toBe(true);
    expect(await tablesOf(event.id, ali.id)).toEqual([tables.T1!.id, tables.T2!.id, tables.T4!.id].sort());
  });

  it("mevcut atamalar korunur: içe aktarılan personelin masaları değişir (kimlik korunur), diğerlerine ve özel görevlere dokunulmaz", async () => {
    const { owner, event, tables, ali, veli, ayse } = await setup();
    const saved = await saveAssignments(db, owner, {
      eventId: event.id,
      assignments: [
        { staffId: ali.id, assignmentType: "table", tableIds: [tables.T1!.id] },
        { staffId: veli.id, assignmentType: "table", tableIds: [tables.T2!.id] },
        { staffId: ayse.id, assignmentType: "special_task", specialTaskLocation: "Vestiyer", tableIds: [] },
      ],
    });
    const aliId = saved.assignments.find((a) => a.staffId === ali.id)?.id;

    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["S-001", null, "T3", null, null, null]]),
    });
    expect(result.written).toBe(true);
    expect(await tablesOf(event.id, ali.id)).toEqual([tables.T3!.id]);
    expect(await tablesOf(event.id, veli.id)).toEqual([tables.T2!.id]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.staffId === ali.id)?.id).toBe(aliId);
    expect(rows.find((r) => r.staffId === ayse.id)).toMatchObject({ assignmentType: "special_task", specialTaskLocation: "Vestiyer" });
  });

  it("aynı personelin (aynı vardiya) birden çok satırı tek atamada birleşir", async () => {
    const { owner, event, tables, ali } = await setup();
    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["S-001", null, "T1", null, null, "Şef"], ["S-001", null, "T2", null, null, null]]),
    });
    expect(result.written).toBe(true);
    expect(await tablesOf(event.id, ali.id)).toEqual([tables.T1!.id, tables.T2!.id].sort());
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("Şef");
  });

  it("başlık takma adları: Sicil / Ad Soyad / Masa / Shift / Rol", async () => {
    const { owner, event, ali } = await setup();
    const result = await importAssignments(db, owner, {
      eventId: event.id,
      bytes: await xlsx([["SİCİL", "masa", "rol"], ["S-001", "T1", "Garson"]]),
    });
    expect(result.written).toBe(true);
    expect((await tablesOf(event.id, ali.id)).length).toBe(1);
  });

  it("önizleme hiçbir şey yazmaz", async () => {
    const { owner, event } = await setup();
    const before = await snapshot(event.id);
    const preview = await previewAssignmentImport(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["S-001", null, "T1", null, null, null]]),
    });
    expect(preview).toMatchObject({ okCount: 1, errorCount: 0 });
    expect(await snapshot(event.id)).toEqual(before);
  });

  it("zorunlu başlık eksikse invalid; yetki, sahiplik ve tamamlanmış etkinlik", async () => {
    const { owner, event } = await setup();
    const bytes = await xlsx([HEADER, ["S-001", null, "T1", null, null, null]]);
    await expectDomain(
      importAssignments(db, owner, { eventId: event.id, bytes: await xlsx([["Personel adı", "Vardiya"], ["Ali Yılmaz", "x"]]) }),
      "invalid",
      /Masa etiketleri veya Grup/,
    );
    await expect(importAssignments(db, await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" })), { eventId: event.id, bytes })).rejects.toBeInstanceOf(ForbiddenError);
    await expectDomain(importAssignments(db, await actorOf("organizer"), { eventId: event.id, bytes }), "not_found");
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));
    await expectDomain(importAssignments(db, owner, { eventId: event.id, bytes }), "conflict");
    await expectDomain(previewAssignmentImport(db, owner, { eventId: event.id, bytes }), "conflict");
  });
});
