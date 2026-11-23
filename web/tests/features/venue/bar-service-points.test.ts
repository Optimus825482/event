import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStaffAssignments, servicePoints } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { saveLayout } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const bar = (id: string, label: string, x = 100, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "bar" as const,
  x,
  y: 40,
  width: 120,
  height: 40,
  label,
  ...extra,
});
const stage = { id: "stage-1", kind: "stage" as const, x: 500, y: 10, width: 300, height: 80, label: "Sahne" };
const decorOf = (...elements: Array<ReturnType<typeof bar> | typeof stage>) => ({ width: 1600, height: 900, elements });

async function setup() {
  const u = await f.createUser(db, { role: "organizer" });
  const actor: Actor = { id: u.id, username: u.username, role: u.role, staffId: u.staffId };
  const event = await f.createEvent(db, { organizerId: actor.id });
  const save = (decor: ReturnType<typeof decorOf>) => saveLayout(db, actor, { eventId: event.id, tables: [], decor });
  const points = () => db.select().from(servicePoints).where(eq(servicePoints.eventId, event.id)).orderBy(asc(servicePoints.name));
  return { event, save, points };
}

describe("plandaki barlar ve servis noktaları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("her bar bir servis noktası olur; ad, merkez konumu ve renk plandan gelir", async () => {
    const { save, points } = await setup();
    await save(decorOf(stage, bar("b1", "Bar 1", 100, { color: "#112233" }), bar("b2", "  ", 400)));
    const rows = await points();
    expect(rows.map((p) => [p.name, p.pointType, p.x, p.y, p.color, p.layoutElementId])).toEqual([
      ["Bar", "bar", 460, 60, "#b45309", "b2"],
      ["Bar 1", "bar", 160, 60, "#112233", "b1"],
    ]);
  });

  it("yeniden kayıtta nokta korunur (kimlik değişmez), adı ve konumu güncellenir", async () => {
    const { save, points } = await setup();
    await save(decorOf(bar("b1", "Bar 1")));
    const [before] = await points();
    await save(decorOf(bar("b1", "Ana Bar", 700)));
    const rows = await points();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before?.id, name: "Ana Bar", x: 760 });
  });

  it("plandan silinen barın noktası silinir; elle eklenmiş servis noktasına dokunulmaz", async () => {
    const { event, save, points } = await setup();
    await db.insert(servicePoints).values({ eventId: event.id, name: "Vestiyer" });
    await save(decorOf(bar("b1", "Bar 1"), bar("b2", "Bar 2", 400)));
    await save(decorOf(bar("b2", "Bar 2", 400)));
    expect((await points()).map((p) => p.name)).toEqual(["Bar 2", "Vestiyer"]);
    await save(decorOf(stage));
    expect((await points()).map((p) => p.name)).toEqual(["Vestiyer"]);
  });

  it("personel atanmış bar silinemez: kayıt reddedilir, atama ve nokta yerinde kalır", async () => {
    const { event, save, points } = await setup();
    await save(decorOf(bar("b1", "Bar 1")));
    const [point] = await points();
    const staff = await f.createStaff(db);
    await db.insert(eventStaffAssignments).values({ eventId: event.id, staffId: staff.id, assignmentType: "service_point", servicePointId: point?.id });
    const err = await save(decorOf(stage)).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).message).toContain('"Bar 1"');
    expect(await points()).toHaveLength(1);
    expect(await db.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, event.id))).toHaveLength(1);
    // Taşımak ve yeniden adlandırmak serbesttir.
    await save(decorOf(bar("b1", "Bar A", 900)));
    expect((await points())[0]).toMatchObject({ id: point?.id, name: "Bar A" });
  });
});
