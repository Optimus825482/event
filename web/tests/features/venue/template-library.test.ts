import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { venueActionDefs } from "@/features/venue/action-defs";
import { countTemplateTabs, filterTemplates } from "@/features/venue/components/template-filter";
import { buildTemplatePreview, tableRadius } from "@/features/venue/components/template-preview-model";
import { parseTemplateLayout } from "@/features/venue/template-layout";
import { createBlankTemplate, listVenueTemplates } from "@/features/venue/templates-service";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(role: Role = "organizer"): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

describe("createBlankTemplate", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masasız şablonu işlemi yapanın adına yazar ve varsayılan özel olur", async () => {
    const actor = await makeActor("venue_owner");
    const row = await createBlankTemplate(db, actor, { name: "  Boş Salon ", description: " not " });
    expect(row).toMatchObject({ name: "Boş Salon", description: "not", isPublic: false, createdById: actor.id });
    const layout = parseTemplateLayout(row.layoutData);
    expect(layout.tables).toHaveLength(0);
    expect(layout.decor.elements).toHaveLength(0);
    const [summary] = await listVenueTemplates(db, actor);
    expect(summary).toMatchObject({ tableCount: 0, capacity: 0, canManage: true });
  });

  it("eylem: mekân sahibi oluşturur, doğrulama alan hatası verir, yetkisiz rol reddedilir", async () => {
    const run = async (actor: Actor | null, input: unknown) => {
      const { defineAction } = createAction({ getActor: async () => actor });
      return defineAction(venueActionDefs.createBlankTemplate)(input);
    };
    const owner = await makeActor("venue_owner");
    const ok = await run(owner, { name: "Salon", description: "", isPublic: true });
    expect(ok.ok).toBe(true);
    const [row] = await db.select().from(venueTemplates);
    expect(row).toMatchObject({ name: "Salon", description: null, isPublic: true, createdById: owner.id });

    const bad = await run(owner, { name: "   " });
    expect(bad).toMatchObject({ ok: false, code: "invalid" });
    if (!bad.ok) expect(bad.fieldErrors?.name?.length).toBeGreaterThan(0);

    const staff = await makeActor("staff");
    expect(await run(staff, { name: "X" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(venueTemplates)).toHaveLength(1);
  });

  it("başka kullanıcıya ait özel şablon listede görünmez", async () => {
    const a = await makeActor("organizer");
    const b = await makeActor("organizer");
    await createBlankTemplate(db, a, { name: "A özel" });
    await createBlankTemplate(db, a, { name: "A açık", isPublic: true });
    expect((await listVenueTemplates(db, b)).map((t) => t.name)).toEqual(["A açık"]);
  });
});

describe("şablon süzme ve sayımlar", () => {
  const rows = [
    { name: "Düğün Salonu", description: "Büyük salon", createdByName: "Ayşe", isPublic: true },
    { name: "Konser", description: null, createdByName: "Ben", isPublic: false },
    { name: "İstanbul Gala", description: "düğün için", createdByName: null, isPublic: false },
  ];

  it("sekme sayıları aramaya göre hesaplanır", () => {
    expect(countTemplateTabs(rows, "")).toEqual({ all: 3, public: 1, private: 2 });
    expect(countTemplateTabs(rows, "düğün")).toEqual({ all: 2, public: 1, private: 1 });
  });

  it("Türkçe büyük/küçük harf ve ad/açıklama/oluşturan alanlarında arar", () => {
    expect(filterTemplates(rows, "İSTANBUL", "all").map((t) => t.name)).toEqual(["İstanbul Gala"]);
    expect(filterTemplates(rows, "ayşe", "all").map((t) => t.name)).toEqual(["Düğün Salonu"]);
  });

  it("sekmeler herkese açık / özel olarak ayırır", () => {
    expect(filterTemplates(rows, "", "public").map((t) => t.name)).toEqual(["Düğün Salonu"]);
    expect(filterTemplates(rows, "", "private").map((t) => t.name)).toEqual(["Konser", "İstanbul Gala"]);
  });
});

describe("buildTemplatePreview", () => {
  const decor = { width: 1000, height: 600, elements: [] };

  it("boş yerleşim yalnızca tuvali gösterir ve empty işaretlenir", () => {
    const m = buildTemplatePreview({ tables: [], decor });
    expect(m.empty).toBe(true);
    expect(m.viewBox).toEqual({ x: -40, y: -40, width: 1080, height: 680 });
  });

  it("masa x/y merkezdir; loca dikdörtgendir; VIP isteğe bağlı alandan okunur", () => {
    const m = buildTemplatePreview({
      tables: [
        { label: "1", capacity: 10, x: 100, y: 200, isLoca: false },
        { label: "2", capacity: 4, x: 300, y: 200, isLoca: true },
        { label: "3", capacity: 4, x: 500, y: 200, isLoca: false, isVip: true },
      ],
      decor,
    });
    const [std, loca, vip] = m.tables;
    expect(std).toMatchObject({ kind: "standard", cx: 100, cy: 200, rx: tableRadius(10), ry: tableRadius(10) });
    expect(loca?.kind).toBe("loca");
    expect(loca && loca.rx > loca.ry).toBe(true);
    expect(vip?.kind).toBe("vip");
  });

  it("tuvalin dışına taşan masa ve dekor görünümü genişletir; ek alanlar sorun çıkarmaz", () => {
    const table = { label: "1", capacity: 8, x: 1500, y: -100, isLoca: false, isPinned: true, size: "L", floor: 2 };
    const m = buildTemplatePreview({
      tables: [table],
      decor: {
        width: 1000,
        height: 600,
        elements: [{ id: "s", kind: "stage", x: -200, y: 0, width: 100, height: 50, rotation: 0, label: "Sahne" }],
      },
    });
    expect(m.viewBox.x).toBeLessThanOrEqual(-240);
    expect(m.viewBox.x + m.viewBox.width).toBeGreaterThanOrEqual(1500 + tableRadius(8));
    expect(m.viewBox.y).toBeLessThanOrEqual(-100 - tableRadius(8));
    expect(m.empty).toBe(false);
  });

  it("sonlu olmayan koordinatlar 0'a düşer", () => {
    const m = buildTemplatePreview({
      tables: [{ label: "1", capacity: 8, x: Number.NaN, y: Number.POSITIVE_INFINITY, isLoca: false }],
      decor,
    });
    expect(m.tables[0]).toMatchObject({ cx: 0, cy: 0 });
    expect(Number.isFinite(m.viewBox.width)).toBe(true);
  });

  it("kapasiteli yarıçap sınırlıdır", () => {
    expect(tableRadius(1)).toBe(24);
    expect(tableRadius(100)).toBe(48);
  });
});
