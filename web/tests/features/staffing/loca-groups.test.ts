import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, organizationTemplates, tableGroups } from "@/db/schema";
import { saveTableGroups } from "@/features/staffing/groups-service";
import { saveOrganization } from "@/features/staffing/organization-service";
import { saveTableGroupsSchema } from "@/features/staffing/schemas";
import { applyOrganizationTemplate } from "@/features/staffing/templates-service";
import { saveLayout } from "@/features/venue/service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, makeActor } from "./helpers";

const decor = { width: 1200, height: 800, elements: [] };

async function setup() {
  const actor = await makeActor();
  const event = await f.createEvent(db, { organizerId: actor.id });
  const normal = await f.createTable(db, event.id, { label: "A1", x: 0, y: 0 });
  const loca = await f.createTable(db, event.id, { label: "L1", x: 50, y: 0, isLoca: true });
  return { actor, event, normal, loca };
}

describe("loca grupları tutarlılığı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("loca grubuna loca olmayan masa eklenemez", async () => {
    const { actor, event, normal } = await setup();
    const err = await expectDomain(
      saveTableGroups(db, actor, {
        eventId: event.id,
        groups: [{ name: "Localar", groupType: "loca", tableIds: [normal.id] }],
      }),
      "conflict",
    );
    expect(err.message).toBe("Loca grubuna yalnızca loca masaları eklenebilir: A1");
  });

  it("standart gruba loca masası eklenemez", async () => {
    const { actor, event, loca } = await setup();
    const err = await expectDomain(
      saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "Std", tableIds: [loca.id] }] }),
      "conflict",
    );
    expect(err.message).toBe("Loca masaları yalnızca loca grubuna eklenebilir: L1");
  });

  it("loca grubu loca masalarıyla kaydedilir", async () => {
    const { actor, event, loca } = await setup();
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "Localar", groupType: "loca", tableIds: [loca.id] }],
    });
    const [row] = await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id));
    expect(row?.groupType).toBe("loca");
  });

  it("geçersiz grup tipi reddedilir", () => {
    const parsed = saveTableGroupsSchema.safeParse({
      eventId: crypto.randomUUID(),
      groups: [{ name: "G", groupType: "vip", tableIds: [] }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.message)).toContain("Geçersiz grup tipi");
  });

  it("şablondaki tanınmayan grup tipi standart olur", async () => {
    const { actor, event, normal } = await setup();
    const [template] = await db
      .insert(organizationTemplates)
      .values({
        name: "Eski",
        createdById: actor.id,
        tableGroups: [{ name: "G", color: "#3b82f6", groupType: "vip", tables: [{ id: normal.id, label: "A1" }] }],
      })
      .returning();
    await applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: template!.id });
    const rows = await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.groupType).toBe("standard");
  });

  it("gruptaki masanın loca bayrağı yerleşimde değiştirilemez", async () => {
    const { actor, event, normal, loca } = await setup();
    await saveTableGroups(db, actor, {
      eventId: event.id,
      groups: [{ name: "Localar", groupType: "loca", tableIds: [loca.id] }],
    });
    const layout = (isLoca: boolean) => ({
      eventId: event.id,
      decor,
      tables: [
        { id: normal.id, label: "A1", capacity: 8, x: 0, y: 0 },
        { id: loca.id, label: "L1", capacity: 8, x: 50, y: 0, isLoca },
      ],
    });
    const err = await expectDomain(saveLayout(db, actor, layout(false)), "conflict");
    expect(err.message).toBe("Gruptaki masanın loca durumu değiştirilemez; önce masayı gruptan çıkarın: L1");
    const [still] = await db.select().from(eventTables).where(eq(eventTables.id, loca.id));
    expect(still?.isLoca).toBe(true);

    await saveTableGroups(db, actor, { eventId: event.id, groups: [] });
    await saveLayout(db, actor, layout(false));
    const [after] = await db.select().from(eventTables).where(eq(eventTables.id, loca.id));
    expect(after?.isLoca).toBe(false);
  });
  it("şablon uygulamada loca grubundaki loca olmayan masa reddedilir", async () => {
    const { actor, event, normal } = await setup();
    const [template] = await db
      .insert(organizationTemplates)
      .values({
        name: "Kötü",
        createdById: actor.id,
        tableGroups: [{ name: "G", color: "#3b82f6", groupType: "loca", tables: [{ id: normal.id, label: "A1" }] }],
      })
      .returning();
    const err = await expectDomain(
      applyOrganizationTemplate(db, actor, { eventId: event.id, templateId: template!.id }),
      "conflict",
    );
    expect(err.message).toBe("Loca grubuna yalnızca loca masaları eklenebilir: A1");
    expect(await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id))).toHaveLength(0);
  });

  it("standart gruptaki masa yerleşimde loca yapılamaz", async () => {
    const { actor, event, normal, loca } = await setup();
    await saveTableGroups(db, actor, { eventId: event.id, groups: [{ name: "Std", tableIds: [normal.id] }] });
    const err = await expectDomain(
      saveLayout(db, actor, {
        eventId: event.id,
        decor,
        tables: [
          { id: normal.id, label: "A1", capacity: 8, x: 0, y: 0, isLoca: true },
          { id: loca.id, label: "L1", capacity: 8, x: 50, y: 0, isLoca: true },
        ],
      }),
      "conflict",
    );
    expect(err.message).toBe("Gruptaki masanın loca durumu değiştirilemez; önce masayı gruptan çıkarın: A1");
  });

  it("organizasyon kaydı da aynı kuralı uygular ve hiçbir şey yazmaz", async () => {
    const { actor, event, loca } = await setup();
    const err = await expectDomain(
      saveOrganization(db, actor, {
        eventId: event.id,
        teams: [],
        groups: [{ name: "Std", tableIds: [loca.id] }],
        assignments: [],
      }),
      "conflict",
    );
    expect(err.message).toBe("Loca masaları yalnızca loca grubuna eklenebilir: L1");
    expect(await db.select().from(tableGroups).where(eq(tableGroups.eventId, event.id))).toHaveLength(0);
  });
});
