import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventArchives, eventFinanceItems, orders } from "@/db/schema";
import { archiveActionDefs } from "@/features/archive/action-defs";
import { rebuildArchive } from "@/features/archive/service";
import type { Actor } from "@/features/auth/session";
import { changeEventStatus } from "@/features/events/service";
import { createAction } from "@/lib/action";
import { assistantActor, managerActor, memberActor, persistActor } from "../../helpers/actors";
import { getArchiveRow, seedScenario } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

beforeEach(truncateAll);

describe("arşivi yeniden oluşturma", () => {
  it("güncel veriden yazar ve revision artar", async () => {
    const s = await seedScenario(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    await changeEventStatus(db, actor, { id: s.event.id, status: "completed" });
    await db.update(eventFinanceItems).set({ actualAmount: "2000.00" }).where(eq(eventFinanceItems.label, "Sahne"));
    await db.update(orders).set({ isDemo: true }).where(eq(orders.eventId, s.event.id));
    expect(await rebuildArchive(db, actor, { eventId: s.event.id })).toEqual({ eventId: s.event.id, revision: 2 });
    expect(await getArchiveRow(db, s.event.id)).toMatchObject({
      revision: 2,
      actualExpense: "3200.00",
      ticketsSold: 0,
      ticketRevenue: "0.00",
      demoTicketsSold: 6,
      demoTicketRevenue: "1051.50",
    });
  });

  it("tamamlanmamış etkinlik conflict döner", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    for (const status of ["active", "cancelled"] as const) {
      const event = await f.createEvent(db, { status });
      await expect(rebuildArchive(db, actor, { eventId: event.id })).rejects.toMatchObject({
        code: "conflict",
        message: "Yalnızca tamamlanmış etkinliğin arşivi oluşturulabilir",
      });
    }
    expect(await db.select().from(eventArchives)).toHaveLength(0);
  });

  it("arşiv satırı olmayan tamamlanmış etkinlikte satırı oluşturur (revision 1)", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    const event = await f.createEvent(db, { status: "completed" });
    expect(await rebuildArchive(db, actor, { eventId: event.id })).toEqual({ eventId: event.id, revision: 1 });
    expect(await getArchiveRow(db, event.id)).toMatchObject({ revision: 1, archivedBy: actor.id });
  });

  it("olmayan etkinlik not_found döner", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(
      rebuildArchive(db, actor, { eventId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "not_found", message: "Etkinlik bulunamadı" });
  });

  it("eylem: Yönetici Asistanı oluşturur; yalnızca görüntüleme ve F&B yöneticisi oluşturamaz", async () => {
    const event = await f.createEvent(db, { status: "completed" });
    const run = (actor: Actor) => {
      const { defineAction } = createAction({ getActor: async () => actor });
      return defineAction(archiveActionDefs.rebuild as never) as (
        raw: unknown,
      ) => Promise<{ ok: boolean; code?: string }>;
    };
    const asst = await persistActor(db, assistantActor("entertainment"));
    const viewer = await persistActor(db, memberActor("entertainment", { archive: "v---" }));
    const fnb = await persistActor(db, managerActor("fnb"));
    expect(await run(viewer)({ eventId: event.id })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await run(fnb)({ eventId: event.id })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await getArchiveRow(db, event.id)).toBeUndefined();
    expect(await run(asst)({ eventId: event.id })).toMatchObject({ ok: true, data: { revision: 1 } });
  });
});
