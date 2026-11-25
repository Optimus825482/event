import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments } from "@/db/schema";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { getOrganization, saveOrganization } from "@/features/staffing/organization-service";
import { saveOrganizationSchema } from "@/features/staffing/schemas";
import { applyOrganizationTemplate } from "@/features/staffing/templates-service";
import { organizationTemplates } from "@/db/schema";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, setupEvent } from "./helpers";
import { legacyActor } from "../../helpers/actors";

const rowsOf = (eventId: string) => db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, eventId));

describe("kişiye özel saat (Özel saat)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("vardiyadan farklı saat saklanır, gece yarısını geçen aralık geçerli; vardiyayla aynı saat saklanmaz", async () => {
    const { actor, event, people } = await setupEvent();
    const shift = await f.createShift(db, { startTime: "18:00", endTime: "02:00" });
    await saveAssignments(db, actor, {
      eventId: event.id,
      assignments: [
        { staffId: people[0]!.id, shiftId: shift.id, shiftStart: "19:30", shiftEnd: "03:00", assignmentType: "table", tableIds: [] },
        { staffId: people[1]!.id, shiftId: shift.id, shiftStart: "18:00", shiftEnd: "02:00:00", assignmentType: "table", tableIds: [] },
        { staffId: people[2]!.id, shiftStart: "10:00", shiftEnd: "16:00", assignmentType: "table", tableIds: [] },
      ],
    });
    const rows = await rowsOf(event.id);
    const byStaff = new Map(rows.map((r) => [r.staffId, r]));
    expect(byStaff.get(people[0]!.id)).toMatchObject({ shiftStart: "19:30:00", shiftEnd: "03:00:00" });
    expect(byStaff.get(people[1]!.id)).toMatchObject({ shiftStart: null, shiftEnd: null });
    expect(byStaff.get(people[2]!.id)).toMatchObject({ shiftStart: "10:00:00", shiftEnd: "16:00:00" });
    const org = await getOrganization(db, actor, event.id);
    expect(org.assignments.find((a) => a.staffId === people[0]!.id)).toMatchObject({ shiftStart: "19:30:00", shiftEnd: "03:00:00" });
  });

  it("servis tek saatli ve eşit saatli özel saati reddeder (zod atlansa da), hiçbir şey yazılmaz", async () => {
    const { actor, event, people } = await setupEvent();
    for (const times of [
      { shiftStart: "19:00", shiftEnd: null },
      { shiftStart: null, shiftEnd: "02:00" },
      { shiftStart: "19:00", shiftEnd: "19:00:00" },
    ]) {
      const err = await expectDomain(
        saveOrganization(db, actor, {
          eventId: event.id,
          teams: [],
          groups: [],
          assignments: [{ staffId: people[0]!.id, ...times, assignmentType: "table", tableIds: [] }],
        }),
        "conflict",
      );
      expect(err.message).toContain("Özel saat");
    }
    expect(await rowsOf(event.id)).toHaveLength(0);
  });

  it("şema: özel saat çifti birlikte ve farklı olmalı", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const parse = (shiftStart: string | null, shiftEnd: string | null) =>
      saveOrganizationSchema.safeParse({
        eventId: id,
        teams: [],
        groups: [],
        assignments: [{ staffId: id, shiftStart, shiftEnd, tableIds: [] }],
      }).success;
    expect(parse("18:00", "02:00")).toBe(true);
    expect(parse(null, null)).toBe(true);
    expect(parse("", "")).toBe(true);
    expect(parse("18:00", null)).toBe(false);
    expect(parse("18:00", "18:00")).toBe(false);
  });

  it("veritabanı CHECK: tek saat ya da eşit saat reddedilir", async () => {
    const { event, people } = await setupEvent();
    const ins = (shiftStart: string | null, shiftEnd: string | null) =>
      db.insert(eventStaffAssignments).values({ eventId: event.id, staffId: people[0]!.id, shiftStart, shiftEnd });
    await expect(ins("18:00", null)).rejects.toThrow();
    await expect(ins("18:00", "18:00")).rejects.toThrow();
    await ins("18:00", "02:00");
    expect(await rowsOf(event.id)).toHaveLength(1);
  });

  it("şablondaki geçersiz özel saat (eski biçim) vardiya saatine döner, uygulama başarısız olmaz", async () => {
    const { actor, event, people } = await setupEvent();
    const [template] = await db
      .insert(organizationTemplates)
      .values({
        name: "Eski",
        createdById: actor.id,
        staffAssignments: [{ staffId: people[0]!.id, assignmentType: "table", shiftStart: "18:00", shiftEnd: null, tables: [] }],
      })
      .returning();
    await applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: template!.id });
    const rows = await rowsOf(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ shiftStart: null, shiftEnd: null });
  });

  it("yetki aynen: başka organizatör özel saat yazamaz", async () => {
    const { event, people } = await setupEvent();
    await expectDomain(
      saveAssignments(db, await legacyActor(db, "organizer"), {
        eventId: event.id,
        assignments: [{ staffId: people[0]!.id, shiftStart: "19:00", shiftEnd: "23:00", assignmentType: "table", tableIds: [] }],
      }),
      "not_found",
    );
  });
});
