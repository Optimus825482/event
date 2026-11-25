import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, servicePointRoleRequirements, servicePoints } from "@/db/schema";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { getOrganization, saveOrganization } from "@/features/staffing/organization-service";
import { saveOrganizationSchema } from "@/features/staffing/schemas";
import { applyOrganizationTemplate, createOrganizationTemplate } from "@/features/staffing/templates-service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent } from "./helpers";
import { legacyActor } from "../../helpers/actors";

async function point(eventId: string, name = "Bar 1", allowedRoles: string[] = []) {
  const [row] = await db.insert(servicePoints).values({ eventId, name, allowedRoles }).returning();
  if (!row) throw new Error("servis noktası eklenemedi");
  return row;
}

const base = (eventId: string) => ({ eventId, teams: [], groups: [], assignments: [], extraStaff: [] });

async function requirements(servicePointId: string) {
  return db
    .select({ role: servicePointRoleRequirements.role, requiredCount: servicePointRoleRequirements.requiredCount })
    .from(servicePointRoleRequirements)
    .where(eq(servicePointRoleRequirements.servicePointId, servicePointId))
    .orderBy(asc(servicePointRoleRequirements.sortOrder));
}

describe("servis noktası rolleri (saveOrganization)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("roller normalize edilip allowed_roles'a, sayısı > 0 olanlar gereksinim tablosuna yazılır; okuma birleştirir", async () => {
    const { actor, event } = await setupEvent();
    const sp = await point(event.id);
    await saveOrganization(db, actor, {
      ...base(event.id),
      servicePointRoles: [
        { servicePointId: sp.id, roles: [{ role: " Barman ", requiredCount: 2 }, { role: "Hostes", requiredCount: 0 }] },
      ],
    });
    const [row] = await db.select().from(servicePoints).where(eq(servicePoints.id, sp.id));
    expect(row?.allowedRoles).toEqual(["barman", "hostes"]);
    expect(await requirements(sp.id)).toEqual([{ role: "barman", requiredCount: 2 }]);
    const org = await getOrganization(db, actor, event.id);
    expect(org.servicePointRoles).toEqual([
      { servicePointId: sp.id, roles: [{ role: "barman", requiredCount: 2 }, { role: "hostes", requiredCount: 0 }] },
    ]);

    await saveOrganization(db, actor, { ...base(event.id), servicePointRoles: [{ servicePointId: sp.id, roles: [] }] });
    const [cleared] = await db.select().from(servicePoints).where(eq(servicePoints.id, sp.id));
    expect(cleared?.allowedRoles).toEqual([]);
    expect(await requirements(sp.id)).toEqual([]);
  });

  it("servicePointRoles gönderilmezse rollere dokunulmaz", async () => {
    const { actor, event } = await setupEvent();
    const sp = await point(event.id, "Bar 1", ["garson"]);
    await saveOrganization(db, actor, base(event.id));
    const [row] = await db.select().from(servicePoints).where(eq(servicePoints.id, sp.id));
    expect(row?.allowedRoles).toEqual(["garson"]);
  });

  it("rol tanımlı noktaya izinsiz ya da boş görevli atama conflict; büyük/küçük harf ve boşluk fark etmez", async () => {
    const { actor, event, people } = await setupEvent();
    const sp = await point(event.id, "Bar 1", ["barman"]);
    const sp2 = { assignmentType: "service_point" as const, servicePointId: sp.id, tableIds: [] };
    const err = await expectDomain(
      saveAssignments(db, actor, { eventId: event.id, assignments: [{ staffId: people[0]!.id, role: "garson", ...sp2 }] }),
      "conflict",
    );
    expect(err.message).toContain("Bar 1");
    await expectDomain(
      saveAssignments(db, actor, { eventId: event.id, assignments: [{ staffId: people[0]!.id, role: null, ...sp2 }] }),
      "conflict",
    );
    expect(await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id))).toHaveLength(0);

    await saveAssignments(db, actor, { eventId: event.id, assignments: [{ staffId: people[0]!.id, role: " BARMAN ", ...sp2 }] });
    expect(await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id))).toHaveLength(1);
  });

  it("rol tanımsız noktada her görev serbest; aynı kayıtta değişen roller atamadan önce uygulanır", async () => {
    const { actor, event, people } = await setupEvent();
    const sp = await point(event.id);
    const assignment = { staffId: people[0]!.id, role: "hostes", assignmentType: "service_point" as const, servicePointId: sp.id, tableIds: [] };
    await saveOrganization(db, actor, { ...base(event.id), assignments: [assignment] });

    // Rol listesi "hostes"i dışarıda bırakırsa aynı kayıt reddedilir ve hiçbir şey değişmez.
    await expectDomain(
      saveOrganization(db, actor, {
        ...base(event.id),
        assignments: [assignment],
        servicePointRoles: [{ servicePointId: sp.id, roles: [{ role: "barman", requiredCount: 1 }] }],
      }),
      "conflict",
    );
    expect(await requirements(sp.id)).toEqual([]);

    await saveOrganization(db, actor, {
      ...base(event.id),
      assignments: [assignment],
      servicePointRoles: [{ servicePointId: sp.id, roles: [{ role: "hostes", requiredCount: 1 }] }],
    });
    expect(await requirements(sp.id)).toEqual([{ role: "hostes", requiredCount: 1 }]);
  });

  it("başka etkinliğin servis noktası conflict; başka organizatör not_found (yetki aynen)", async () => {
    const { actor, event } = await setupEvent();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreign = await point(other.id);
    await expectDomain(
      saveOrganization(db, actor, { ...base(event.id), servicePointRoles: [{ servicePointId: foreign.id, roles: [] }] }),
      "conflict",
    );
    const own = await point(event.id);
    await expectDomain(
      saveOrganization(db, await legacyActor(db, "organizer"), {
        ...base(event.id),
        servicePointRoles: [{ servicePointId: own.id, roles: [{ role: "garson", requiredCount: 1 }] }],
      }),
      "not_found",
    );
    expect(await requirements(own.id)).toEqual([]);
  });

  it("şema: yinelenen rol, negatif ve kesirli sayı reddedilir", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const parse = (roles: Array<{ role: string; requiredCount: number }>) =>
      saveOrganizationSchema.safeParse({ ...base(id), servicePointRoles: [{ servicePointId: id, roles }] }).success;
    expect(parse([{ role: "garson", requiredCount: 1 }])).toBe(true);
    expect(parse([{ role: "Garson", requiredCount: 1 }, { role: "garson ", requiredCount: 2 }])).toBe(false);
    expect(parse([{ role: "garson", requiredCount: -1 }])).toBe(false);
    expect(parse([{ role: "garson", requiredCount: 1.5 }])).toBe(false);
    expect(parse([{ role: "  ", requiredCount: 1 }])).toBe(false);
  });

  it("veritabanı: sıfır sayı ve boş rol CHECK ile, aynı rol tekillikle reddedilir; nokta silinince gereksinimler silinir", async () => {
    const { event } = await setupEvent();
    const sp = await point(event.id);
    const ins = (role: string, requiredCount: number) =>
      db.insert(servicePointRoleRequirements).values({ eventId: event.id, servicePointId: sp.id, role, requiredCount });
    await expect(ins("garson", 0)).rejects.toThrow();
    await expect(ins(" ", 1)).rejects.toThrow();
    await ins("garson", 1);
    await expect(ins("garson", 2)).rejects.toThrow();
    const other = await f.createEvent(db);
    await expect(
      db.insert(servicePointRoleRequirements).values({ eventId: other.id, servicePointId: sp.id, role: "barman", requiredCount: 1 }),
    ).rejects.toThrow();
    await db.delete(servicePoints).where(eq(servicePoints.id, sp.id));
    expect(await requirements(sp.id)).toEqual([]);
  });

  it("şablon uygulama: hedef noktanın rollerine uymayan atama atlanır ve raporlanır", async () => {
    const src = await setupEvent({ tableCount: 1, staffCount: 2 });
    const bar = await point(src.event.id);
    await saveAssignments(db, src.actor, {
      eventId: src.event.id,
      assignments: [
        { staffId: src.people[0]!.id, role: "barman", assignmentType: "service_point", servicePointId: bar.id, tableIds: [] },
        { staffId: src.people[1]!.id, role: "garson", assignmentType: "service_point", servicePointId: bar.id, tableIds: [] },
      ],
    });
    const template = await createOrganizationTemplate(db, src.actor, { eventId: src.event.id, name: "Bar" });
    const target = await f.createEvent(db, { organizerId: src.actor.id });
    await point(target.id, "Bar 1", ["barman"]);

    const report = await applyOrganizationTemplate(db, src.actor, { eventId: target.id, templateId: template.id });

    expect(report.roleMismatches).toEqual([`${src.people[1]!.id} @ Bar 1`]);
    const rows = await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, target.id));
    expect(rows.map((r) => r.staffId)).toEqual([src.people[0]!.id]);
  });
});
