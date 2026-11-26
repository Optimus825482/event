import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventSaleSettings } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { seatingActionDefs } from "@/features/seating/action-defs";
import { saleSettingsSchema } from "@/features/seating/schemas";
import { DEFAULT_SALE_SETTINGS, getSaleSettings, saveSaleSettings } from "@/features/seating/settings-service";
import { createAction } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setAllocation } from "../../helpers/seating";
import { watchEvents } from "../realtime/emitted";

const baseFields = {
  sharedTables: true,
  blockSingleLeftover: true,
  locaOnline: false,
  holdMinutes: 15,
  maxSeatsPerOrder: 12,
};

function input(eventId: string, o: Record<string, unknown> = {}) {
  return saleSettingsSchema.parse({ eventId, ...baseFields, ...o });
}

function fieldErrorsOf(raw: Record<string, unknown>): Record<string, string[] | undefined> | null {
  const r = saleSettingsSchema.safeParse({ eventId: crypto.randomUUID(), ...baseFields, ...raw });
  return r.success ? null : r.error.flatten().fieldErrors;
}

describe("satış ayarları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satır yokken varsayılanlar döner", async () => {
    const event = await f.createEvent(db);
    expect(await getSaleSettings(db, event.id)).toEqual({ eventId: event.id, ...DEFAULT_SALE_SETTINGS });
  });

  it("Entertainment yöneticisi kaydeder; ikinci kayıt aynı satırı günceller", async () => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    await saveSaleSettings(db, actor, input(event.id, { holdMinutes: 15 }));
    const saved = await saveSaleSettings(db, actor, input(event.id, { holdMinutes: 20 }));
    const rows = await db.select().from(eventSaleSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ holdMinutes: 20, updatedBy: actor.id });
    expect(saved).toEqual(await getSaleSettings(db, event.id));
    expect(saved.holdMinutes).toBe(20);
  });

  it("Casino yöneticisi kaydedemez", async () => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, managerActor("casino"));
    await expect(saveSaleSettings(db, actor, input(event.id))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.select().from(eventSaleSettings)).toHaveLength(0);
  });

  it("yalnızca görüntüleme izni olan Entertainment kullanıcısı kaydedemez", async () => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, memberActor("entertainment", { ticketing: "v---" }));
    await expect(saveSaleSettings(db, actor, input(event.id))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("şema: tutma süresi ve adet aralıkları", () => {
    for (const holdMinutes of [4, 31]) {
      expect(fieldErrorsOf({ holdMinutes })?.holdMinutes).toEqual(["Tutma süresi 5 ile 30 dakika arasında olmalı"]);
    }
    for (const maxSeatsPerOrder of [0, 51]) {
      expect(fieldErrorsOf({ maxSeatsPerOrder })?.maxSeatsPerOrder).toEqual([
        "Sipariş başına adet 1 ile 50 arasında olmalı",
      ]);
    }
  });

  it("şema: tarih Kıbrıs duvar saatiyle çözülür, boş metin null olur", () => {
    const ok = saleSettingsSchema.parse({
      eventId: crypto.randomUUID(),
      ...baseFields,
      saleStartsAt: "2027-01-10T20:00",
      saleEndsAt: "",
    });
    expect(ok.saleStartsAt?.toISOString()).toBe("2027-01-10T18:00:00.000Z");
    expect(ok.saleEndsAt).toBeNull();
  });

  it("şema: çözülemeyen tarih reddedilir", () => {
    expect(fieldErrorsOf({ saleStartsAt: "dün" })?.saleStartsAt).toEqual(["Geçersiz tarih"]);
  });

  it("şema: bitiş başlangıçtan sonra olmalı", () => {
    expect(
      fieldErrorsOf({ saleStartsAt: "2027-01-10T20:00", saleEndsAt: "2027-01-10T20:00" })?.saleEndsAt,
    ).toEqual(["Satış bitişi başlangıçtan sonra olmalı"]);
  });

  it("online loca varken locaOnline kapatılamaz", async () => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    await saveSaleSettings(db, actor, input(event.id, { locaOnline: true, holdMinutes: 15 }));
    const loca = await f.createTable(db, event.id, { label: "L1", isLoca: true });
    await setAllocation(db, [loca.id], "online");
    await expect(
      saveSaleSettings(db, actor, input(event.id, { locaOnline: false, holdMinutes: 25 })),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "Online satıştaki localar var: L1. Önce bu locaları satıştan çıkarın.",
    });
    expect(await getSaleSettings(db, event.id)).toMatchObject({ locaOnline: true, holdMinutes: 15 });
  });

  it("tamamlanmış etkinlikte kaydedilemez", async () => {
    const event = await f.createEvent(db, { status: "completed" });
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(saveSaleSettings(db, actor, input(event.id))).rejects.toMatchObject({
      code: "conflict",
      message: "Tamamlanmış veya iptal edilmiş etkinliğin satış kuralları değiştirilemez",
    });
  });

  it("olmayan etkinlik not_found verir", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(saveSaleSettings(db, actor, input(crypto.randomUUID()))).rejects.toMatchObject({
      code: "not_found",
      message: "Etkinlik bulunamadı",
    });
  });

  it("kayıt sales.changed yayar; reddedilen kayıt yaymaz", async () => {
    const event = await f.createEvent(db);
    const ok = await persistActor(db, managerActor("entertainment"));
    const denied = await persistActor(db, managerActor("casino"));
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      await saveSaleSettings(db, ok, input(event.id));
      expect(await watch.settled()).toEqual(["sales.changed"]);
      await expect(saveSaleSettings(db, denied, input(event.id))).rejects.toBeInstanceOf(ForbiddenError);
      expect(await watch.settled()).toEqual(["sales.changed"]);
    } finally {
      watch.stop();
    }
  });

  it("eylem: geçersiz girdi alan hatalarıyla döner", async () => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, managerActor("entertainment"));
    const save = createAction({ getActor: async () => actor }).defineAction(seatingActionDefs.saveSettings);
    const res = await save({ eventId: event.id, ...baseFields, holdMinutes: 99 });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    if (!res.ok) expect(res.fieldErrors?.holdMinutes).toBeDefined();
    expect(await db.select().from(eventSaleSettings).where(eq(eventSaleSettings.eventId, event.id))).toHaveLength(0);
  });
});
