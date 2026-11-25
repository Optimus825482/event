import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getFloorPlan } from "@/features/venue/plan-service";
import { applyVenueTemplate, getVenueLayout, saveAsTemplate, saveLayout } from "@/features/venue/service";
import { parseTemplateLayout } from "@/features/venue/template-layout";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(): Promise<Actor> {
  return persistActor(db, managerActor("entertainment"));
}

const lines = [
  { id: "l1", x1: 80, y1: 200, x2: 880, y2: 200, color: "#ef4444", width: 4 },
  { id: "l2", x1: 400, y1: 40, x2: 400, y2: 560, color: "#38bdf8", width: 2 },
];
const decor = { width: 960, height: 600, elements: [], lines };

describe("ayırıcı çizgilerin kalıcılığı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("çizgiler layout_decor içinde saklanır; düzenleyici ve salt okunur plan geri okur", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    await saveLayout(db, actor, { eventId: event.id, tables: [{ label: "M1", capacity: 8, x: 100, y: 100 }], decor });
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row?.layoutDecor).toMatchObject({ lines });
    expect((await getVenueLayout(db, actor, event.id)).decor.lines).toEqual(lines);
    expect((await getFloorPlan(db, actor, event.id)).lines).toEqual(lines);
  });

  it("çizgisiz eski kayıt boş çizgi listesiyle okunur", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    await db.update(events).set({ layoutDecor: { width: 900, height: 600, elements: [] } }).where(eq(events.id, event.id));
    expect((await getVenueLayout(db, actor, event.id)).decor.lines).toBeUndefined();
    expect((await getFloorPlan(db, actor, event.id)).lines).toEqual([]);
  });

  it("geçersiz çizgi kaydı reddeder ve önceki yerleşim korunur", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    await saveLayout(db, actor, { eventId: event.id, tables: [], decor });
    const bad = { ...decor, lines: [{ id: "far", x1: 80, y1: 200, x2: 5000, y2: 200, color: "#ef4444", width: 4 }] };
    const err = await saveLayout(db, actor, { eventId: event.id, tables: [], decor: bad }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DomainError);
    expect((await getVenueLayout(db, actor, event.id)).decor.lines).toEqual(lines);
  });

  it("şablona kaydedilen çizgiler şablon uygulanınca yeni etkinliğe geçer", async () => {
    const actor = await makeActor();
    const source = await f.createEvent(db, { organizerId: actor.id });
    await saveLayout(db, actor, { eventId: source.id, tables: [], decor });
    const tpl = await saveAsTemplate(db, actor, { eventId: source.id, name: "Çizgili salon" });
    expect(parseTemplateLayout(tpl.layoutData).decor.lines).toEqual(lines);
    const target = await f.createEvent(db, { organizerId: actor.id });
    const res = await applyVenueTemplate(db, actor, { eventId: target.id, templateId: tpl.id });
    expect(res.decor.lines).toEqual(lines);
    expect((await getFloorPlan(db, actor, target.id)).lines).toEqual(lines);
  });
});
