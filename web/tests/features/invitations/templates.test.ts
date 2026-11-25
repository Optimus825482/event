import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitationTemplates } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { invitationActionDefs } from "@/features/invitations/action-defs";
import { DEFAULT_TEMPLATE_ELEMENTS, smartFixElements } from "@/features/invitations/elements";
import {
  createTemplate,
  deleteTemplate,
  ensureDefaultTemplate,
  getTemplate,
  listTemplates,
  setDefaultTemplate,
  updateTemplate,
} from "@/features/invitations/templates";
import { saveEventInvitation } from "@/features/invitations/event-invitation";
import { createAction } from "@/lib/action";
import { adminActor, managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(actor: Actor = managerActor("entertainment")): Promise<Actor> {
  return persistActor(db, actor);
}

/** Sahiplik testleri: eski organizatör rolü (yalnızca kendi kayıtlarını görür). */
async function makeOrganizer(): Promise<Actor> {
  const u = await f.createUser(db, { role: "organizer" });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

const base = { size: "A5" as const, width: 559, height: 794, backgroundColor: null, backgroundImage: null, backgroundGradient: null };
const el = { id: "t1", type: "text" as const, x: 10, y: 10, width: 100, height: 40, content: "Merhaba" };

describe("şablonlar", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("varsayılan sistem şablonunu eşzamanlı çağrılarda tek satır olarak oluşturur", async () => {
    await Promise.all(Array.from({ length: 5 }, () => ensureDefaultTemplate(db)));
    const rows = await db.select().from(invitationTemplates);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isSystemTemplate: true, isDefault: true, isActive: true });
    expect(rows[0]?.elements).toEqual(DEFAULT_TEMPLATE_ELEMENTS);
  });

  it("oluşturur, günceller, listeler", async () => {
    const admin = await makeActor(adminActor());
    const created = await createTemplate(db, admin, { ...base, name: "Düğün", elements: [el] });
    expect(created).toMatchObject({ name: "Düğün", isSystemTemplate: false, isDefault: false, createdById: admin.id });
    const updated = await updateTemplate(db, admin, { ...base, id: created.id, name: "Düğün 2", elements: [] });
    expect(updated.name).toBe("Düğün 2");
    const list = await listTemplates(db, admin);
    expect(list.map((t) => t.name)).toContain("Düğün 2");
    expect(list[0]?.isDefault).toBe(true);
  });

  it("sistem şablonu silinemez; varsayılan silinince sistem şablonu varsayılan olur", async () => {
    const admin = await makeActor(adminActor());
    await ensureDefaultTemplate(db);
    const [system] = await db.select().from(invitationTemplates);
    if (!system) throw new Error("sistem şablonu yok");
    await expect(deleteTemplate(db, admin, { id: system.id })).rejects.toMatchObject({ code: "conflict" });

    const mine = await createTemplate(db, admin, { ...base, name: "Benim", elements: [] });
    await setDefaultTemplate(db, admin, { id: mine.id });
    const afterSet = await db.select().from(invitationTemplates);
    expect(afterSet.filter((t) => t.isDefault).map((t) => t.id)).toEqual([mine.id]);

    await deleteTemplate(db, admin, { id: mine.id });
    const [gone] = await db.select().from(invitationTemplates).where(eq(invitationTemplates.id, mine.id));
    expect(gone).toMatchObject({ isActive: false, isDefault: false });
    const [restored] = await db.select().from(invitationTemplates).where(eq(invitationTemplates.id, system.id));
    expect(restored?.isDefault).toBe(true);
    await expect(deleteTemplate(db, admin, { id: mine.id })).rejects.toMatchObject({ code: "not_found" });
    await expect(setDefaultTemplate(db, admin, { id: mine.id })).rejects.toMatchObject({ code: "not_found" });
  });

  it("kaydederken öğeleri tuval sınırlarına düzeltir", async () => {
    const admin = await makeActor(adminActor());
    const wild = { ...el, x: -50, y: 900, width: 10, height: 10, fontSize: 500 };
    const row = await createTemplate(db, admin, { ...base, name: "Taşan", elements: [wild] });
    const [saved] = row.elements as { x: number; y: number; width: number; height: number; fontSize: number }[];
    expect(saved).toMatchObject({ x: 10, width: 20, height: 20 });
    expect((saved?.y ?? 0) + (saved?.height ?? 0)).toBeLessThanOrEqual(794);
    expect(saved?.fontSize).toBeLessThanOrEqual(72);
    expect(smartFixElements([wild], 559, 794)[0]).toMatchObject({ x: 10 });
  });

  it("ayar kapalıysa yönetim işlemleri reddedilir", async () => {
    const admin = await makeActor(adminActor());
    const { systemSettings } = await import("@/db/schema");
    await db.insert(systemSettings).values({ invitationSystemEnabled: false });
    await expect(createTemplate(db, admin, { ...base, name: "X", elements: [] })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("devre dışı"),
    });
  });
});

describe("şablon sahipliği", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function setup() {
    const a = await makeOrganizer();
    const b = await makeOrganizer();
    const admin = await makeActor(adminActor());
    const mine = await createTemplate(db, a, { ...base, name: "A'nın", elements: [] });
    await ensureDefaultTemplate(db);
    const [system] = await db.select().from(invitationTemplates).where(eq(invitationTemplates.isSystemTemplate, true));
    if (!system) throw new Error("sistem şablonu yok");
    return { a, b, admin, mine, system };
  }

  it("başka organizatör güncelleyemez/silemez/göremez (not_found); yönetici ve sahibi yapabilir", async () => {
    const { a, b, admin, mine } = await setup();
    const input = { ...base, id: mine.id, name: "Ele geçirildi", elements: [] };
    await expect(updateTemplate(db, b, input)).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteTemplate(db, b, { id: mine.id })).rejects.toMatchObject({ code: "not_found" });
    await expect(getTemplate(db, b, mine.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await listTemplates(db, b)).map((t) => t.id)).not.toContain(mine.id);
    expect((await listTemplates(db, a)).map((t) => t.id)).toContain(mine.id);
    expect((await updateTemplate(db, a, { ...input, name: "Yeni" })).name).toBe("Yeni");
    expect((await updateTemplate(db, admin, { ...input, name: "Yönetici" })).name).toBe("Yönetici");
    await deleteTemplate(db, admin, { id: mine.id });
  });

  it("organizatör sistem şablonunu görür ama değiştiremez; yönetici değiştirebilir", async () => {
    const { b, admin, system } = await setup();
    expect((await listTemplates(db, b)).map((t) => t.id)).toContain(system.id);
    await expect(updateTemplate(db, b, { ...base, id: system.id, name: "X", elements: [] })).rejects.toMatchObject({ code: "conflict" });
    await expect(deleteTemplate(db, b, { id: system.id })).rejects.toMatchObject({ code: "conflict" });
    expect((await updateTemplate(db, admin, { ...base, id: system.id, name: "Sistem 2", elements: [] })).name).toBe("Sistem 2");
  });

  it("varsayılanı yalnızca yönetici değiştirir", async () => {
    const { a, admin, mine } = await setup();
    await expect(setDefaultTemplate(db, a, { id: mine.id })).rejects.toMatchObject({ code: "conflict" });
    const [def] = await db.select().from(invitationTemplates).where(eq(invitationTemplates.isDefault, true));
    expect(def?.id).not.toBe(mine.id);
    await setDefaultTemplate(db, admin, { id: mine.id });
    const [now] = await db.select().from(invitationTemplates).where(eq(invitationTemplates.isDefault, true));
    expect(now?.id).toBe(mine.id);
  });

  it("etkinliğe yalnızca görebildiği şablon bağlanır", async () => {
    const { a, b, system } = await setup();
    const foreign = await createTemplate(db, b, { ...base, name: "B'nin", elements: [] });
    const event = await f.createEvent(db, { organizerId: a.id });
    const payload = { eventId: event.id, ...base, backgroundColor: "#FFFFFF", customElements: null, companyLogo: null };
    await expect(saveEventInvitation(db, a, { ...payload, templateId: foreign.id })).rejects.toMatchObject({ code: "not_found" });
    await expect(saveEventInvitation(db, a, { ...payload, templateId: system.id })).resolves.toHaveProperty("id");
  });
});

describe("şablon action'ları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  function actionsFor(actor: Actor | null) {
    const { defineAction } = createAction({ getActor: async () => actor });
    return {
      create: defineAction(invitationActionDefs.createTemplate),
      remove: defineAction(invitationActionDefs.deleteTemplate),
    };
  }

  it("staff rolü şablon oluşturamaz; oturumsuz reddedilir", async () => {
    const staff = await makeActor(noAccessActor());
    const payload = { ...base, name: "X", elements: [] };
    expect(await actionsFor(staff).create(payload)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await actionsFor(null).create(payload)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await db.select().from(invitationTemplates)).toHaveLength(0);
  });

  it("zararlı renk/görüntü yolu reddedilir (invalid)", async () => {
    const organizer = await makeActor(managerActor("entertainment"));
    const res = await actionsFor(organizer).create({
      ...base,
      name: "X",
      elements: [{ ...el, backgroundColor: "url(http://evil.example/p.png)" }],
    });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    const res2 = await actionsFor(organizer).create({ ...base, name: "X", backgroundImage: "http://evil.example/a.png", elements: [] });
    expect(res2).toMatchObject({ ok: false, code: "invalid" });
    expect(await db.select().from(invitationTemplates)).toHaveLength(0);
  });

  it("organizatör oluşturup silebilir", async () => {
    const organizer = await makeActor(managerActor("entertainment"));
    const res = await actionsFor(organizer).create({ ...base, name: "Benim", elements: [el] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await actionsFor(organizer).remove({ id: res.data.id })).ok).toBe(true);
  });
});
