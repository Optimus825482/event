import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  eventExtraStaff,
  eventStaffAssignments,
  events,
  organizationTemplates,
  servicePoints,
  staff,
  tableGroups,
  teamMembers,
  teams,
} from "@/db/schema";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { saveExtraStaff } from "@/features/staffing/extra-staff-service";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { saveTeams } from "@/features/staffing/teams-service";
import { applyOrganizationTemplate, createOrganizationTemplate } from "@/features/staffing/templates-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent, snapshot, tablesOfAssignment } from "./helpers";

/*
 * §13.11 başarı yolu kararları (spec "özel görevler kaybolmaz" cümlesi hata yolunu anlatır; başarıda
 * eski sistemin davranışı korunur: `team-organization.service.ts` `applyOrganizationTemplate`):
 *  - DEĞİŞTİRME: hedefin ekipleri, grupları ve bütün atamaları (masa, özel görev, servis noktası) silinir,
 *    yerine şablonunkiler yazılır; birleştirme yoktur.
 *  - Hedefin kadro dışı personeli (extra staff) şablondan etkilenmez.
 *  - Aktif olmayan/olmayan personel atlanır ve raporlanır; eşleşme yalnızca staff.id iledir.
 *  - Tek transaction: herhangi bir adım hata verirse hedef aynen kalır.
 */

type Person = Awaited<ReturnType<typeof setupEvent>>["people"][number];

/** Kaynakta: Ekip A (lider p1, üye p2), grup "Ön" (M01), p2 → M01+M02 masa ataması, p3 özel görev. */
async function buildTemplate() {
  const src = await setupEvent({ tableCount: 2, staffCount: 3 });
  const [p1, p2, p3] = src.people as [Person, Person, Person];
  const res = await saveTeams(db, src.actor, {
    eventId: src.event.id,
    teams: [{ name: "Ekip A", leaderStaffId: p1.id, members: [{ staffId: p1.id, isLeader: true }, { staffId: p2.id }] }],
  });
  const teamId = res.teams[0]!.id;
  await saveTableGroups(db, src.actor, {
    eventId: src.event.id,
    groups: [{ name: "Ön", teamId, supervisorStaffId: p1.id, tableIds: [src.tables[0]!.id] }],
  });
  await saveAssignments(db, src.actor, {
    eventId: src.event.id,
    assignments: [
      { staffId: p2.id, teamId, assignmentType: "table", tableIds: [src.tables[0]!.id, src.tables[1]!.id] },
      { staffId: p3.id, assignmentType: "special_task", specialTaskLocation: "Vestiyer", tableIds: [] },
    ],
  });
  const template = await createOrganizationTemplate(db, src.actor, { eventId: src.event.id, name: "Şablon" });
  return { src, template, p1, p2, p3 };
}

/** Hedefte şablondan bağımsız: ekip, grup, masa ataması, özel görev, servis noktası ataması, kadro dışı personel. */
async function dirtyTarget(actor: Awaited<ReturnType<typeof setupEvent>>["actor"]) {
  const target = await f.createEvent(db, { organizerId: actor.id });
  const t1 = await f.createTable(db, target.id, { label: "M01" });
  const t2 = await f.createTable(db, target.id, { label: "M02" });
  const [point] = await db.insert(servicePoints).values({ eventId: target.id, name: "Eski Bar" }).returning();
  const a = await f.createStaff(db);
  const b = await f.createStaff(db);
  const c = await f.createStaff(db);
  const res = await saveTeams(db, actor, { eventId: target.id, teams: [{ name: "Eski ekip", members: [{ staffId: a.id }] }] });
  await saveTableGroups(db, actor, { eventId: target.id, groups: [{ name: "Eski grup", teamId: res.teams[0]!.id, tableIds: [t2.id] }] });
  await saveAssignments(db, actor, {
    eventId: target.id,
    assignments: [
      { staffId: a.id, assignmentType: "table", tableIds: [t2.id] },
      { staffId: b.id, assignmentType: "special_task", specialTaskLocation: "Bar", tableIds: [] },
      { staffId: c.id, assignmentType: "service_point", servicePointId: point!.id, tableIds: [] },
    ],
  });
  await saveExtraStaff(db, actor, {
    eventId: target.id,
    extraStaff: [{ fullName: "Geçici Garson", tableIds: [], groupIds: [] }],
  });
  return { target, t1, t2, point: point!, a, b, c };
}

describe("şablon uygulama başarı yolu (spec §13.11)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("birleştirmez, değiştirir: hedefin eski ekip/grup/masa/özel görev/servis noktası atamaları gider", async () => {
    const { src, template, p2, p3 } = await buildTemplate();
    const { target, t1, a, b, c } = await dirtyTarget(src.actor);

    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });

    expect(report).toMatchObject({ teams: 1, groups: 1, assignments: 2 });
    expect((await db.select().from(teams).where(eq(teams.eventId, target.id))).map((t) => t.name)).toEqual(["Ekip A"]);
    expect((await db.select().from(tableGroups).where(eq(tableGroups.eventId, target.id))).map((g) => g.name)).toEqual(["Ön"]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id));
    expect(rows.map((r) => r.staffId).sort()).toEqual([p2.id, p3.id].sort());
    for (const old of [a, b, c]) expect(rows.some((r) => r.staffId === old.id)).toBe(false);
    expect(rows.find((r) => r.staffId === p3.id)).toMatchObject({ assignmentType: "special_task", specialTaskLocation: "Vestiyer" });
    const members = await db.select().from(teamMembers);
    expect(members.some((m) => m.staffId === a.id)).toBe(false);
    expect((await tablesOfAssignment(rows.find((r) => r.staffId === p2.id)!.id)).length).toBe(2);
    expect(t1.id).toBeDefined();
  });

  it("hedefin kadro dışı personeline dokunulmaz", async () => {
    const { src, template } = await buildTemplate();
    const { target } = await dirtyTarget(src.actor);
    await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    const extra = await db.select().from(eventExtraStaff).where(eq(eventExtraStaff.eventId, target.id));
    expect(extra.map((e) => e.fullName)).toEqual(["Geçici Garson"]);
  });

  it("ikinci kez uygulamak aynı sonucu verir (yinelenme yok)", async () => {
    const { src, template } = await buildTemplate();
    const { target } = await dirtyTarget(src.actor);
    const first = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    const second = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    expect(second).toEqual(first);
    const after = await snapshot(target.id);
    expect(after.teams).toHaveLength(1);
    expect(after.groups).toHaveLength(1);
    expect(after.assignments).toHaveLength(2);
  });

  it("boş şablon hedefin organizasyonunu temizler (eski sistemdeki gibi tam değiştirme)", async () => {
    const { actor } = await setupEvent();
    const [empty] = await db
      .insert(organizationTemplates)
      .values({ name: "Boş", createdById: actor.id, teamAssignments: [], tableGroups: [], staffAssignments: [] })
      .returning();
    const { target } = await dirtyTarget(actor);
    const report = await applyOrganizationTemplate(db, actor, { eventId: target.id, templateId: empty!.id });
    expect(report).toMatchObject({ teams: 0, groups: 0, assignments: 0 });
    const after = await snapshot(target.id);
    expect([after.teams, after.groups, after.assignments]).toEqual([[], [], []]);
  });

  it("pasif lider ve gözetmen boşaltılır, pasif üye atlanır ve raporlanır; ekip yine kurulur", async () => {
    const { src, template, p1, p2 } = await buildTemplate();
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    await db.update(staff).set({ status: "inactive" }).where(eq(staff.id, p1.id));
    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    expect(report.missingStaffIds).toEqual([p1.id]);
    const [team] = await db.select().from(teams).where(eq(teams.eventId, target.id));
    expect(team?.leaderStaffId).toBeNull();
    const [group] = await db.select().from(tableGroups).where(eq(tableGroups.eventId, target.id));
    expect(group?.supervisorStaffId).toBeNull();
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, team!.id));
    expect(members.map((m) => m.staffId)).toEqual([p2.id]);
  });

  it("hedefte olmayan masalar atlanır ve raporlanır; atama kalan masalarıyla yazılır", async () => {
    const { src, template, p2 } = await buildTemplate();
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    const only = await f.createTable(db, target.id, { label: "M02" });
    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });
    expect(report.missingTables.map((t) => t.label)).toEqual(["M01"]);
    const row = (await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id))).find(
      (r) => r.staffId === p2.id,
    );
    expect(await tablesOfAssignment(row!.id)).toEqual([only.id]);
  });

  it("hedefte kullanılamayan vardiya ve servis noktası atlanır ve raporlanır; adı eşleşen servis noktası bağlanır", async () => {
    const src = await setupEvent({ tableCount: 1, staffCount: 3 });
    const [p1, p2, p3] = src.people as [Person, Person, Person];
    const ownShift = await f.createShift(db, { eventId: src.event.id });
    const globalShift = await f.createShift(db);
    const [bar] = await db.insert(servicePoints).values({ eventId: src.event.id, name: "Bar 1" }).returning();
    const [vip] = await db.insert(servicePoints).values({ eventId: src.event.id, name: "VIP" }).returning();
    await saveAssignments(db, src.actor, {
      eventId: src.event.id,
      assignments: [
        { staffId: p1.id, shiftId: ownShift.id, assignmentType: "table", tableIds: [] },
        { staffId: p2.id, shiftId: globalShift.id, assignmentType: "service_point", servicePointId: bar!.id, tableIds: [] },
        { staffId: p3.id, assignmentType: "service_point", servicePointId: vip!.id, tableIds: [] },
      ],
    });
    const template = await createOrganizationTemplate(db, src.actor, { eventId: src.event.id, name: "Vardiyalı" });
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    const [targetBar] = await db.insert(servicePoints).values({ eventId: target.id, name: "Bar 1" }).returning();

    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });

    expect(report.missingShiftIds).toEqual([ownShift.id]);
    expect(report.missingServicePoints).toEqual(["VIP"]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ staffId: p2.id, shiftId: globalShift.id, servicePointId: targetBar!.id });
  });

  it("tamamlanmış hedef etkinlikte uygulanamaz ve hiçbir şey değişmez", async () => {
    const { src, template } = await buildTemplate();
    const { target } = await dirtyTarget(src.actor);
    const before = await snapshot(target.id);
    await db.update(events).set({ status: "completed" }).where(eq(events.id, target.id));
    await expectDomain(applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id }), "conflict");
    expect(await snapshot(target.id)).toEqual(before);
  });

  it("ekip ve gruplar yazıldıktan sonra atama adımı hata verirse hepsi geri alınır (özel görevler dahil)", async () => {
    const { src, p1, p2 } = await buildTemplate();
    const { target } = await dirtyTarget(src.actor);
    const before = await snapshot(target.id);
    // Aynı masada iki ayrı ekibin ataması: yalnızca atama adımında reddedilir.
    const ref = { id: crypto.randomUUID(), label: "M01" };
    const [bad] = await db
      .insert(organizationTemplates)
      .values({
        name: "Çelişkili",
        createdById: src.actor.id,
        teamAssignments: [
          { key: "a", name: "A", color: "#111111", members: [] },
          { key: "b", name: "B", color: "#222222", members: [] },
        ],
        tableGroups: [{ name: "G", color: "#111111", teamKey: "a", tables: [ref] }],
        staffAssignments: [
          { staffId: p1.id, teamKey: "a", assignmentType: "table", tables: [ref] },
          { staffId: p2.id, teamKey: "b", assignmentType: "table", tables: [ref] },
        ],
      })
      .returning();
    await expectDomain(applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: bad!.id }), "conflict");
    expect(await snapshot(target.id)).toEqual(before);
  });
});

describe("şablon uygulama: biçimsiz kimlikler (M10 uuid denetimi)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("36 karakterlik uuid olmayan personel ve vardiya kimliği ham veritabanı hatası vermez; atlanır ve raporlanır", async () => {
    const { actor, event } = await setupEvent();
    const fake = "-".repeat(36);
    const [tpl] = await db
      .insert(organizationTemplates)
      .values({
        name: "Bozuk kimlik",
        createdById: actor.id,
        teamAssignments: [],
        tableGroups: [],
        staffAssignments: [{ staffId: fake, shiftId: fake, assignmentType: "table", tables: [] }],
      })
      .returning();
    const report = await applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: tpl!.id });
    expect(report.missingStaffIds).toEqual([fake]);
    expect(report.assignments).toBe(0);
  });
});
