import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { seatingActionDefs } from "@/features/seating/action-defs";
import { getSeatingOverview } from "@/features/seating/queries";
import { DEFAULT_SALE_SETTINGS } from "@/features/seating/settings-service";
import { createAction } from "@/lib/action";
import { managerActor, memberActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setSaleSettings } from "../../helpers/seating";

async function setup() {
  const event = await f.createEvent(db);
  await f.createTable(db, event.id, { label: "A10", capacity: 6, allocation: "pending" });
  await f.createTable(db, event.id, {
    label: "A2",
    capacity: 8,
    sellableSeats: 5,
    saleCategory: "vip",
    allocation: "online",
  });
  const a1 = await f.createTable(db, event.id, { label: "A1", capacity: 8, allocation: "casino" });
  return { event, a1 };
}

describe("masa genel bakış okuma modeli", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("genel bakış masaları etiket sırasıyla ve türetilmiş alanlarla döner", async () => {
    const { event, a1 } = await setup();
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id });
    const actor = await persistActor(db, managerActor("entertainment"));
    const overview = await getSeatingOverview(db, actor, event.id);
    expect(overview.tables.map((t) => t.label)).toEqual(["A1", "A2", "A10"]);
    const [t1, t2] = overview.tables;
    expect(t2).toMatchObject({
      sellableSeats: 5,
      effectiveSellable: 5,
      category: "vip",
      allocation: "online",
      hasActiveReservation: false,
    });
    expect(t1).toMatchObject({ effectiveSellable: 8, hasActiveReservation: true, allocation: "casino" });
  });

  it("iptal rezervasyon masayı rezervasyonlu göstermez", async () => {
    const { event, a1 } = await setup();
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, status: "cancelled" });
    const actor = await persistActor(db, managerActor("entertainment"));
    const overview = await getSeatingOverview(db, actor, event.id);
    expect(overview.tables.find((t) => t.label === "A1")?.hasActiveReservation).toBe(false);
  });

  it("ayar satırı yokken varsayılan kurallar, varsa kayıtlı kurallar döner", async () => {
    const { event } = await setup();
    const actor = await persistActor(db, managerActor("entertainment"));
    expect((await getSeatingOverview(db, actor, event.id)).settings).toEqual({
      eventId: event.id,
      ...DEFAULT_SALE_SETTINGS,
    });
    await setSaleSettings(db, event.id, { holdMinutes: 25 });
    expect((await getSeatingOverview(db, actor, event.id)).settings.holdMinutes).toBe(25);
  });

  it("aşama ve plan birlikte döner", async () => {
    const { event } = await setup();
    const actor = await persistActor(db, managerActor("entertainment"));
    const overview = await getSeatingOverview(db, actor, event.id);
    expect(overview.eventName).toBe(event.name);
    expect(overview.stage).toBe("defined");
    expect(overview.plan.tables).toHaveLength(3);
    expect(overview.plan.tables.find((t) => t.label === "A2")).toMatchObject({ category: "vip", allocation: "online" });
  });

  it("Entertainment ve Casino yöneticisi okur; F&B yöneticisi ve üyeliksiz kullanıcı okuyamaz", async () => {
    const { event } = await setup();
    for (const department of ["entertainment", "casino"] as const) {
      const actor = await persistActor(db, managerActor(department));
      expect((await getSeatingOverview(db, actor, event.id)).tables).toHaveLength(3);
    }
    const fnb = await persistActor(db, managerActor("fnb"));
    await expect(getSeatingOverview(db, fnb, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getSeatingOverview(db, noAccessActor(), event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      getSeatingOverview(db, memberActor("entertainment", { events: "v---" }), event.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("etkinlik yoksa not_found", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(getSeatingOverview(db, actor, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });

  it("eylem tanımları iki yetkiyle de genel bakışı döner", async () => {
    const { event } = await setup();
    expect(seatingActionDefs.overview).toMatchObject({ module: "ticketing", verb: "view" });
    expect(seatingActionDefs.casinoOverview).toMatchObject({ module: "reservations", verb: "view" });
    const ent = await persistActor(db, managerActor("entertainment"));
    const cas = await persistActor(db, managerActor("casino"));
    const run = (actor: typeof ent, def: typeof seatingActionDefs.overview) =>
      createAction({ getActor: async () => actor }).defineAction(def)({ eventId: event.id });
    expect(await run(ent, seatingActionDefs.overview)).toMatchObject({ ok: true });
    expect(await run(cas, seatingActionDefs.casinoOverview)).toMatchObject({ ok: true });
    expect(await run(cas, seatingActionDefs.overview)).toMatchObject({ ok: false });
  });
});
