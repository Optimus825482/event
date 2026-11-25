import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { checkInActionDefs } from "@/features/check-in/action-defs";
import { createAction } from "@/lib/action";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { actorOf, bookedGuest, key } from "./fixtures";
import { memberActor, legacyActor } from "../../helpers/actors";

function as(actor: Actor | null) {
  return createAction({ getActor: async () => actor }).defineAction;
}

describe("check-in action'ları", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("kapı personeli (controller) ve lider check-in, walk-in ve kişi sayısı yapabilir; venue_owner yapamaz", async () => {
    const { event, reservation } = await bookedGuest();
    const free = await createTable(db, event.id, { capacity: 4 });
    const controller = await actorOf(memberActor("casino", { check_in: "vc--" }));
    const leader = await actorOf(memberActor("fnb", { reviews: "vce-", check_in: "vc--", notifications: "v---" }));

    const checked = await as(controller)(checkInActionDefs.checkIn)({
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });
    expect(checked).toMatchObject({
      ok: true,
      data: { outcome: "checked_in" },
    });
    const walkIn = await as(leader)(checkInActionDefs.walkIn)({
      eventId: event.id,
      tableId: free.id,
      guestName: "Lider Misafiri",
      guestCount: "2",
    });
    expect(walkIn).toMatchObject({
      ok: true,
      data: { outcome: "checked_in", guestCount: 2 },
    });
    const count = await as(controller)(checkInActionDefs.updateGuestCount)({
      eventId: event.id,
      reservationId: reservation.id,
      guestCount: 3,
    });
    expect(count).toEqual({
      ok: true,
      data: { reservationId: reservation.id, guestCount: 3 },
    });
    const stats = await as(controller)(checkInActionDefs.stats)({
      eventId: event.id,
    });
    expect(stats).toMatchObject({
      ok: true,
      data: { checkedIn: 2, totalExpected: 2, remaining: 0 },
    });
    const remaining = await as(controller)(checkInActionDefs.freeTables)({
      eventId: event.id,
    });
    expect(remaining.ok && remaining.data.map((t) => t.id)).toEqual([]);

    const owner = await legacyActor(db, "venue_owner");
    expect(await as(owner)(checkInActionDefs.stats)({ eventId: event.id })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(await as(null)(checkInActionDefs.checkIn)({})).toMatchObject({
      ok: false,
      code: "unauthenticated",
    });
  });

  it("geçersiz girdi alan hatalarıyla döner; conflict mesajı kullanıcıya iletilir", async () => {
    const { event, table } = await bookedGuest();
    const controller = await actorOf(memberActor("casino", { check_in: "vc--" }));
    const invalid = await as(controller)(checkInActionDefs.walkIn)({
      eventId: event.id,
      tableId: "",
      guestName: " ",
      guestCount: 0,
    });
    expect(invalid).toMatchObject({ ok: false, code: "invalid" });
    if (!invalid.ok)
      expect(Object.keys(invalid.fieldErrors ?? {}).sort()).toEqual(["guestCount", "guestName", "tableId"]);

    const both = await as(controller)(checkInActionDefs.checkIn)({
      eventId: event.id,
      idempotencyKey: key(),
      token: "a",
      reservationId: table.id,
    });
    expect(both).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { token: [expect.stringContaining("tam olarak biri")] },
    });

    const taken = await as(controller)(checkInActionDefs.walkIn)({
      eventId: event.id,
      tableId: table.id,
      guestName: "X",
      guestCount: 1,
    });
    expect(taken).toEqual({
      ok: false,
      code: "conflict",
      message: "Bu masa için aktif bir rezervasyon var",
    });
  });

  it("manuel arama ad, telefon ve masa etiketine göre bulur, telefonu yalnızca son 4 haneyle verir", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, {
      capacity: 4,
      label: "VIP-3",
    });
    const controller = await actorOf(memberActor("casino", { check_in: "vc--" }));
    await as(controller)(checkInActionDefs.walkIn)({
      eventId: event.id,
      tableId: table.id,
      guestName: "Zeynep Kaya",
      guestCount: 1,
      guestPhone: "0532 444 55 66",
    });
    const search = as(controller)(checkInActionDefs.searchGuests);
    for (const q of ["zeynep", "4445566", "vip-3"]) {
      const r = await search({ eventId: event.id, q });
      expect(r.ok && r.data.map((g) => [g.guestName, g.tableLabel, g.phoneLast4, g.status])).toEqual([
        ["Zeynep Kaya", "VIP-3", "5566", "checked_in"],
      ]);
    }
    const all = await search({ eventId: event.id, q: "" });
    expect(all.ok && all.data.length).toBe(2);
    const none = await search({ eventId: event.id, q: "100%_" });
    expect(none.ok && none.data).toEqual([]);
    const recent = await as(controller)(checkInActionDefs.recentCheckIns)({
      eventId: event.id,
    });
    expect(recent.ok && recent.data.map((r) => r.guestName)).toEqual(["Zeynep Kaya"]);
  });
});
