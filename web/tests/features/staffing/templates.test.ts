import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, organizationTemplates, staff, tableGroups, teams } from "@/db/schema";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { saveTeams } from "@/features/staffing/teams-service";
import {
  applyOrganizationTemplate,
  createOrganizationTemplate,
  deleteOrganizationTemplate,
  listOrganizationTemplates,
} from "@/features/staffing/templates-service";
import { adminActor, legacyActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, makeActor, setupEvent, snapshot, tablesOfAssignment, tablesOfGroup } from "./helpers";

/** Kaynak etkinlikte ekip + grup + masa ataması + özel görev kurar ve şablona çevirir. */
async function sourceTemplate() {
  const src = await setupEvent({ tableCount: 4, staffCount: 3 });
  const [p1, p2, p3] = src.people;
  const t = await saveTeams(db, src.actor, {
    eventId: src.event.id,
    teams: [{ name: "Ekip A", color: "#aa0000", leaderStaffId: p1!.id, members: [{ staffId: p1!.id, isLeader: true }, { staffId: p2!.id }] }],
  });
  const teamId = t.teams[0]!.id;
  await saveTableGroups(db, src.actor, {
    eventId: src.event.id,
    groups: [{ name: "Ön", teamId, supervisorStaffId: p1!.id, tableIds: [src.tables[0]!.id, src.tables[3]!.id] }],
  });
  await saveAssignments(db, src.actor, {
    eventId: src.event.id,
    assignments: [
      { staffId: p2!.id, teamId, assignmentType: "table", tableIds: [src.tables[0]!.id, src.tables[3]!.id] },
      { staffId: p3!.id, assignmentType: "special_task", specialTaskLocation: "Vestiyer", tableIds: [] },
    ],
  });
  const template = await createOrganizationTemplate(db, src.actor, { eventId: src.event.id, name: "Gala düzeni" });
  return { src, template, p1: p1!, p2: p2!, p3: p3! };
}

describe("organizasyon şablonu sahipliği", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("başka organizatör listeleyemez, uygulayamaz (not_found) ve silemez; yönetici ve sahibi yapabilir", async () => {
    const { src, template } = await sourceTemplate();
    const other = await setupEvent({ tableCount: 1, staffCount: 0 });
    const admin = await makeActor(adminActor());

    expect(await listOrganizationTemplates(db, other.actor)).toEqual([]);
    await expectDomain(applyOrganizationTemplate(db, other.actor, { eventId: other.event.id, templateId: template.id }), "not_found");
    await expectDomain(deleteOrganizationTemplate(db, other.actor, { id: template.id }), "not_found");
    expect(await listOrganizationTemplates(db, src.actor)).toHaveLength(1);

    expect((await listOrganizationTemplates(db, admin)).map((t) => t.id)).toEqual([template.id]);
    const target = await f.createEvent(db, { organizerId: admin.id });
    await applyOrganizationTemplate(db, admin, { eventId: target.id, templateId: template.id });
    await deleteOrganizationTemplate(db, admin, { id: template.id });
    expect(await listOrganizationTemplates(db, src.actor)).toHaveLength(0);
  });

  it("görünür ama sahibi olunmayan (varsayılan) şablon silinemez", async () => {
    const { template } = await sourceTemplate();
    await db.update(organizationTemplates).set({ isDefault: true }).where(eq(organizationTemplates.id, template.id));
    const other = await legacyActor(db, "organizer");
    const [listed] = await listOrganizationTemplates(db, other);
    expect(listed).toMatchObject({ id: template.id, canManage: false });
    await expectDomain(deleteOrganizationTemplate(db, other, { id: template.id }), "conflict");
  });
});

describe("organizasyon şablonları (spec §13.11)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("şablon oluşturulur ve listelenir; silinen listeden düşer", async () => {
    const { src, template } = await sourceTemplate();
    const list = await listOrganizationTemplates(db, src.actor);
    expect(list.map((t) => t.id)).toEqual([template.id]);
    await deleteOrganizationTemplate(db, src.actor, { id: template.id });
    expect(await listOrganizationTemplates(db, src.actor)).toHaveLength(0);
  });

  it("başka etkinliğe uygulanır: personel staff.id ile, masa etiketle eşlenir; olmayan masa raporlanır", async () => {
    const { src, template, p1, p2, p3 } = await sourceTemplate();
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    const tm1 = await f.createTable(db, target.id, { label: "M01" });
    await f.createTable(db, target.id, { label: "M02" });
    // Personelin adı değişti; aynı eski ada sahip başka biri var: eşleşme ad ile yapılmamalı.
    await db.update(staff).set({ fullName: "Yeni Ad" }).where(eq(staff.id, p2.id));
    const namesake = await f.createStaff(db, { fullName: "Personel 2" });

    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });

    expect(report.missingTables.map((t) => t.label)).toEqual(["M04"]);
    expect(report.missingStaffIds).toEqual([]);
    const [team] = await db.select().from(teams).where(eq(teams.eventId, target.id));
    expect(team).toMatchObject({ name: "Ekip A", color: "#aa0000", leaderStaffId: p1.id });
    const [group] = await db.select().from(tableGroups).where(eq(tableGroups.eventId, target.id));
    expect(group).toMatchObject({ name: "Ön", teamId: team!.id, supervisorStaffId: p1.id });
    expect(await tablesOfGroup(group!.id)).toEqual([tm1.id]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id));
    expect(rows.map((r) => r.staffId).sort()).toEqual([p2.id, p3.id].sort());
    expect(rows.some((r) => r.staffId === namesake.id)).toBe(false);
    const tableRow = rows.find((r) => r.staffId === p2.id)!;
    expect(tableRow.teamId).toBe(team!.id);
    expect(await tablesOfAssignment(tableRow.id)).toEqual([tm1.id]);
    // Eski sistem şablonda tür bilgisini tutmadığından özel görev kayboluyordu.
    expect(rows.find((r) => r.staffId === p3.id)).toMatchObject({
      assignmentType: "special_task",
      specialTaskLocation: "Vestiyer",
    });
  });

  it("aktif olmayan personel atlanır ve raporlanır", async () => {
    const { src, template, p3 } = await sourceTemplate();
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, p3.id));
    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    expect(report.missingStaffIds).toEqual([p3.id]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id));
    expect(rows.some((r) => r.staffId === p3.id)).toBe(false);
  });

  it("aynı etkinliğe uygulanınca masa kimlikleri birebir eşleşir", async () => {
    const { src, template } = await sourceTemplate();
    const before = await snapshot(src.event.id);
    const report = await applyOrganizationTemplate(db, src.actor, { eventId: src.event.id, templateId: template.id });
    expect(report.missingTables).toEqual([]);
    const after = await snapshot(src.event.id);
    expect(after.groupTables.map((g) => g.tableId)).toEqual(before.groupTables.map((g) => g.tableId));
    expect(after.assignments).toHaveLength(before.assignments.length);
  });

  it("hatalı şablon uygulanırsa hedefin eski durumu (özel görevler dahil) aynen kalır", async () => {
    const { p1 } = await sourceTemplate();
    const target = await setupEvent({ tableCount: 2, staffCount: 1 });
    await saveAssignments(db, target.actor, {
      eventId: target.event.id,
      assignments: [{ staffId: target.people[0]!.id, assignmentType: "special_task", specialTaskLocation: "Bar", tableIds: [] }],
    });
    await saveTeams(db, target.actor, { eventId: target.event.id, teams: [{ name: "Hedef ekip", members: [] }] });
    const before = await snapshot(target.event.id);
    const assignment = {
      staffId: p1.id,
      shiftId: null,
      teamKey: null,
      assignmentType: "table",
      tables: [],
    };
    const [broken] = await db
      .insert(organizationTemplates)
      .values({ name: "Bozuk", createdById: target.actor.id, staffAssignments: [assignment, assignment] })
      .returning();

    await expectDomain(
      applyOrganizationTemplate(db, target.actor, { eventId: target.event.id, templateId: broken!.id }),
      "conflict",
    );
    expect(await snapshot(target.event.id)).toEqual(before);
  });

  it("biçimi bozuk şablon conflict", async () => {
    const { actor, event } = await setupEvent();
    const [bad] = await db
      .insert(organizationTemplates)
      .values({ name: "Eski", createdById: actor.id, staffAssignments: [{ staffName: "Ali", tableIds: "x" }] })
      .returning();
    await expectDomain(applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: bad!.id }), "conflict");
  });

  it("olmayan şablon not_found; başkasının etkinliğine uygulanamaz", async () => {
    const { template } = await sourceTemplate();
    const { actor, event } = await setupEvent();
    await expectDomain(
      applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: crypto.randomUUID() }),
      "not_found",
    );
    const stranger = await legacyActor(db, "organizer");
    await expectDomain(
      applyOrganizationTemplate(db, stranger, { eventId: event.id, templateId: template.id }),
      "not_found",
    );
  });
});
