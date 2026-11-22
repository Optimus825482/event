import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventInvitations } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { invitationActionDefs } from "@/features/invitations/action-defs";
import { DEFAULT_TEMPLATE_ELEMENTS } from "@/features/invitations/elements";
import { getEventInvitationDetail, saveEventInvitation } from "@/features/invitations/event-invitation";
import { createTemplate, ensureDefaultTemplate } from "@/features/invitations/templates";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

sharp.cache(false);

async function makeActor(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId };
}

const design = { size: "A5" as const, width: 559, height: 794, backgroundColor: "#FFFFFF", backgroundImage: null, backgroundGradient: null, companyLogo: null };
const text = { id: "e1", type: "text" as const, x: 20, y: 20, width: 200, height: 40, content: "Selam" };

describe("etkinlik davetiyesi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kayıt yokken varsayılan şablonu gösterir", async () => {
    const admin = await makeActor("admin");
    await ensureDefaultTemplate(db);
    const event = await f.createEvent(db);
    const detail = await getEventInvitationDetail(db, admin, { eventId: event.id });
    expect(detail.layout.source).toBe("default");
    expect(detail.layout.elements).toEqual(DEFAULT_TEMPLATE_ELEMENTS);
  });

  it("kaydeder, ikinci kayıtta aynı satırı günceller (eşzamanlı çağrılarda da tek satır)", async () => {
    const admin = await makeActor("admin");
    const event = await f.createEvent(db);
    const input = { ...design, eventId: event.id, templateId: null, customElements: [text] };
    await Promise.all([saveEventInvitation(db, admin, input), saveEventInvitation(db, admin, input), saveEventInvitation(db, admin, input)]);
    await saveEventInvitation(db, admin, { ...input, customElements: [{ ...text, content: "Yeni" }] });
    const rows = await db.select().from(eventInvitations);
    expect(rows).toHaveLength(1);
    const detail = await getEventInvitationDetail(db, admin, { eventId: event.id });
    expect(detail.layout).toMatchObject({ source: "custom" });
    expect(detail.layout.elements[0]?.content).toBe("Yeni");
  });

  it("şablon seçilince şablon düzeni kullanılır; silinmiş şablon reddedilir", async () => {
    const admin = await makeActor("admin");
    const event = await f.createEvent(db);
    const template = await createTemplate(db, admin, { ...design, name: "Özel", description: undefined, elements: [text] });
    await saveEventInvitation(db, admin, { ...design, eventId: event.id, templateId: template.id, customElements: null });
    const detail = await getEventInvitationDetail(db, admin, { eventId: event.id });
    expect(detail.layout).toMatchObject({ source: "template", templateId: template.id });
    await expect(
      saveEventInvitation(db, admin, { ...design, eventId: event.id, templateId: crypto.randomUUID(), customElements: null }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("organizatör başkasının etkinliğine erişemez", async () => {
    const owner = await makeActor("organizer");
    const other = await makeActor("organizer");
    const event = await f.createEvent(db, { organizerId: owner.id });
    await expect(getEventInvitationDetail(db, other, { eventId: event.id })).rejects.toMatchObject({ code: "not_found" });
    await expect(
      saveEventInvitation(db, other, { ...design, eventId: event.id, templateId: null, customElements: [text] }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.select().from(eventInvitations)).toHaveLength(0);
    await expect(getEventInvitationDetail(db, owner, { eventId: event.id })).resolves.toBeDefined();
  });

  it("staff rolü kaydedemez (action)", async () => {
    const staff = await makeActor("staff");
    const event = await f.createEvent(db);
    const { defineAction } = createAction({ getActor: async () => staff });
    const res = await defineAction(invitationActionDefs.saveEventInvitation)({ ...design, eventId: event.id, customElements: [text] });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("davetiye görselleri (action)", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("yükler, listeye ekler ve kaldırınca dosyayı siler; reddedilen dosya conflict", async () => {
    const organizer = await makeActor("organizer");
    const event = await f.createEvent(db, { organizerId: organizer.id });
    const { defineAction } = createAction({ getActor: async () => organizer });
    const upload = defineAction(invitationActionDefs.uploadImage);
    const remove = defineAction(invitationActionDefs.removeImage);
    dirs.push(await mkdtemp(path.join(os.tmpdir(), "inv-")));

    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#00f" } }).png().toBuffer();
    const form = new FormData();
    form.set("eventId", event.id);
    form.set("file", new File([new Uint8Array(png)], "x.png", { type: "image/png" }));
    const res = await upload(form);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.path).toMatch(/^invitation\/[0-9a-f-]{36}\.webp$/);
    const abs = path.join(UPLOAD_ROOT, res.data.path);
    expect(existsSync(abs)).toBe(true);
    const [row] = await db.select().from(eventInvitations);
    expect(row?.eventImages).toEqual([res.data.path]);

    const bad = new FormData();
    bad.set("eventId", event.id);
    bad.set("file", new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    expect(await upload(bad)).toMatchObject({ ok: false, code: "conflict" });

    expect((await remove({ eventId: event.id, path: res.data.path })).ok).toBe(true);
    expect(existsSync(abs)).toBe(false);
    const [after] = await db.select().from(eventInvitations);
    expect(after?.eventImages).toEqual([]);
    expect(await remove({ eventId: event.id, path: res.data.path })).toMatchObject({ ok: false, code: "not_found" });
  });
});
