import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { reservations } from "@/db/schema";
import { importActionDefs } from "@/features/import/action-defs";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { actorOf, bookableEvent, xlsx, type Cell } from "./helpers";

const HEADER: Cell[] = ["Masa etiketi", "Misafir adı", "Telefon", "E-posta", "Kişi sayısı", "Not"];

function form(eventId: string, bytes: Uint8Array, name = "liste.xlsx"): FormData {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("file", new File([new Uint8Array(bytes)], name));
  return data;
}

describe("içe aktarma action'ları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("FormData ile önizler ve içe aktarır; önizleme yazmaz", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const { defineAction } = createAction({ getActor: async () => owner });
    const preview = defineAction(importActionDefs.previewReservations);
    const run = defineAction(importActionDefs.importReservations);
    const bytes = await xlsx([HEADER, ["A1", "Ali Veli", null, null, 2, null]]);

    const p = await preview(form(event.id, bytes));
    expect(p).toMatchObject({ ok: true, data: { okCount: 1, errorCount: 0 } });
    expect(await db.select().from(reservations)).toHaveLength(0);

    const r = await run(form(event.id, bytes));
    expect(r).toMatchObject({ ok: true, data: { createdCount: 1, skippedCount: 0 } });
    expect(await db.select().from(reservations)).toHaveLength(1);
  });

  it("düz nesneyle de çalışır; dosya yoksa alan hatası, yanlış içerik invalid döner", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const { defineAction } = createAction({ getActor: async () => owner });
    const run = defineAction(importActionDefs.importReservations);

    const missing = await run({ eventId: event.id });
    expect(missing).toMatchObject({ ok: false, code: "invalid" });
    expect(missing.ok ? null : missing.fieldErrors?.file).toEqual(["Dosya seçiniz"]);

    const fake = await run({ eventId: event.id, file: new File(["Masa,Ad\nA1,Ali"], "liste.xlsx") });
    expect(fake).toMatchObject({ ok: false, code: "invalid", message: "Yalnızca .xlsx dosyaları kabul edilir" });
  });

  it("yetkisiz rol forbidden, oturumsuz unauthenticated; atama içe aktarma events.edit ister", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const bytes = await xlsx([HEADER, ["A1", "Ali", null, null, 2, null]]);
    const controller = createAction({ getActor: async () => actorOf("controller") });
    expect(await controller.defineAction(importActionDefs.importReservations)(form(event.id, bytes))).toMatchObject({ ok: false, code: "forbidden" });

    const anon = createAction({ getActor: async () => null });
    expect(await anon.defineAction(importActionDefs.previewReservations)(form(event.id, bytes))).toMatchObject({ ok: false, code: "unauthenticated" });

    const staffer = createAction({ getActor: async () => actorOf("staff") });
    expect(await staffer.defineAction(importActionDefs.importAssignments)(form(event.id, bytes))).toMatchObject({ ok: false, code: "forbidden" });

    const own = createAction({ getActor: async () => owner });
    await f.createStaff(db, { sicilNo: "S-1" });
    const assignBytes = await xlsx([["Sicil no", "Masa etiketleri"], ["S-1", "A1"]]);
    expect(await own.defineAction(importActionDefs.importAssignments)(form(event.id, assignBytes))).toMatchObject({ ok: true, data: { written: true, appliedCount: 1 } });
  });
});
