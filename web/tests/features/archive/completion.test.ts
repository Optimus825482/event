import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  artists,
  eventArchives,
  eventExtraStaff,
  eventFinanceItems,
  eventStaffAssignments,
  eventTables,
  events,
  orders,
  reservations,
} from "@/db/schema";
import { eventActionDefs } from "@/features/events/action-defs";
import { changeEventStatus } from "@/features/events/service";
import { DomainError, createAction } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { getArchiveRow, seedScenario } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

beforeEach(truncateAll);

describe("tamamlanınca arşivleme", () => {
  it("etkinlik tamamlanınca aynı çağrıda arşiv satırı yazılır", async () => {
    const s = await seedScenario(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    const row = await changeEventStatus(db, actor, { id: s.event.id, status: "completed" });
    expect(row.status).toBe("completed");
    expect(await getArchiveRow(db, s.event.id)).toMatchObject({
      revision: 1,
      archivedBy: actor.id,
      eventName: "Gala",
      ticketsSold: 4,
      demoTicketsSold: 2,
    });
  });

  it("tamamlanma dışındaki geçişler arşiv yazmaz", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    const a = await f.createEvent(db, { status: "draft" });
    await changeEventStatus(db, actor, { id: a.id, status: "published" });
    await changeEventStatus(db, actor, { id: a.id, status: "active" });
    const b = await f.createEvent(db, { status: "active" });
    await changeEventStatus(db, actor, { id: b.id, status: "cancelled" });
    expect(await db.select().from(eventArchives)).toHaveLength(0);
  });

  it("tamamlandıktan sonra kaynak satırlar değişse de arşiv değişmez", async () => {
    const s = await seedScenario(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    await changeEventStatus(db, actor, { id: s.event.id, status: "completed" });
    const before = await getArchiveRow(db, s.event.id);

    await db.update(eventTables).set({ capacity: 99 }).where(eq(eventTables.eventId, s.event.id));
    await db.delete(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, s.event.id));
    await db.delete(eventExtraStaff).where(eq(eventExtraStaff.eventId, s.event.id));
    await db
      .update(eventFinanceItems)
      .set({ label: "değişti", actualAmount: "1.00" })
      .where(eq(eventFinanceItems.eventId, s.event.id));
    await db.update(orders).set({ isDemo: true }).where(eq(orders.eventId, s.event.id));
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.eventId, s.event.id));
    await db.update(events).set({ name: "Yeni Ad", artistName: "Başka" }).where(eq(events.id, s.event.id));
    await db.update(artists).set({ name: "Başka Ad", nameKey: "BAŞKA AD" }).where(eq(artists.id, s.artist.id));

    const after = await getArchiveRow(db, s.event.id);
    expect(after).toEqual(before);
    expect(after).toMatchObject({
      totalCapacity: 40,
      fnbStaffCount: 4,
      ticketsSold: 4,
      ticketRevenue: "550.50",
      actualExpense: "1680.00",
      reservationCount: 2,
      eventName: "Gala",
      artistName: "Sezen Aksu",
    });
    expect(after!.details.financeItems[0]!.label).toBe("Sanatçı ücreti");
  });

  it("eşzamanlı iki tamamlama: biri başarılı, diğeri conflict; revision 1", async () => {
    const s = await seedScenario(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    const res = await Promise.allSettled([
      changeEventStatus(db, actor, { id: s.event.id, status: "completed" }),
      changeEventStatus(db, actor, { id: s.event.id, status: "completed" }),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = res.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(DomainError);
    expect((rejected[0]!.reason as DomainError).code).toBe("conflict");
    expect((await getArchiveRow(db, s.event.id))!.revision).toBe(1);
    expect(await db.select().from(eventArchives)).toHaveLength(1);
  });

  it("eylem: events:edit olmayan kullanıcı tamamlayamaz ve arşiv yazılmaz", async () => {
    const event = await f.createEvent(db, { status: "active" });
    const actor = await persistActor(db, managerActor("casino"));
    const { defineAction } = createAction({ getActor: async () => actor });
    const run = defineAction(eventActionDefs.changeStatus as never) as (
      raw: unknown,
    ) => Promise<{ ok: boolean; code?: string }>;
    expect(await run({ id: event.id, status: "completed" })).toMatchObject({ ok: false, code: "forbidden" });
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row!.status).toBe("active");
    expect(await db.select().from(eventArchives)).toHaveLength(0);
  });
});
