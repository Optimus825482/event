import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { eventActionDefs } from "@/features/events/action-defs";
import { getEvent, listEventBoard, setReviewSettings } from "@/features/events/service";
import { createAction } from "@/lib/action";
import { adminActor, managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { setStage } from "../../helpers/planning";
import * as f from "../../helpers/factories";

async function makeActor(actor: Actor = managerActor("entertainment")): Promise<Actor> {
  return persistActor(db, actor);
}

function reviewAction(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(eventActionDefs.reviewSettings);
}

describe("setReviewSettings", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yalnızca verilen anahtarı değiştirir, diğerini korur", async () => {
    const actor = await makeActor();
    const ev = await f.createEvent(db, { organizerId: actor.id });
    expect(ev.reviewEnabled).toBe(false);

    const first = await setReviewSettings(db, actor, { id: ev.id, reviewEnabled: true });
    expect(first).toMatchObject({ reviewEnabled: true, reviewHistoryVisible: false });
    const second = await setReviewSettings(db, actor, { id: ev.id, reviewHistoryVisible: true });
    expect(second).toMatchObject({ reviewEnabled: true, reviewHistoryVisible: true });
    const third = await setReviewSettings(db, actor, { id: ev.id, reviewEnabled: false });
    expect(third).toMatchObject({ reviewEnabled: false, reviewHistoryVisible: true });
  });

  it("tamamlanmış etkinlikte de değişir (değerlendirme bitişten sonra açılabilir)", async () => {
    const actor = await makeActor();
    const ev = await f.createEvent(db, { organizerId: actor.id, status: "completed" });
    const row = await setReviewSettings(db, actor, { id: ev.id, reviewEnabled: true });
    expect(row.reviewEnabled).toBe(true);
  });

  it("admin ve Entertainment yöneticisi başkasının oluşturduğu etkinlikte değiştirebilir", async () => {
    const owner = await makeActor();
    const admin = await makeActor(adminActor());
    const ev = await f.createEvent(db, { organizerId: owner.id });
    const row = await setReviewSettings(db, admin, { id: ev.id, reviewHistoryVisible: true });
    expect(row.reviewHistoryVisible).toBe(true);
    const other = await makeActor();
    expect((await setReviewSettings(db, other, { id: ev.id, reviewEnabled: true })).reviewEnabled).toBe(true);
  });

  it("olmayan etkinlik not_found", async () => {
    const actor = await makeActor();
    await expect(
      setReviewSettings(db, actor, { id: "00000000-0000-4000-8000-000000000000", reviewEnabled: true }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("setEventReviewSettingsAction", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("Entertainment yöneticisi ayarı değiştirir", async () => {
    const actor = await makeActor();
    const ev = await f.createEvent(db, { organizerId: actor.id });
    const res = await reviewAction(actor)({ id: ev.id, reviewEnabled: true });
    expect(res).toMatchObject({ ok: true, data: { id: ev.id, reviewEnabled: true, reviewHistoryVisible: false } });
  });

  it("üyeliksiz kullanıcı forbidden", async () => {
    const outsider = await makeActor(noAccessActor());
    const ev = await f.createEvent(db);
    expect(await reviewAction(outsider)({ id: ev.id, reviewEnabled: true })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("hiçbir anahtar verilmezse invalid", async () => {
    const actor = await makeActor();
    const ev = await f.createEvent(db, { organizerId: actor.id });
    expect(await reviewAction(actor)({ id: ev.id })).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("listEventBoard / getEvent hazırlık sayaçları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masa ve atama sayılarını verir; başkasının oluşturduğu etkinlik de listelenir", async () => {
    const actor = await makeActor();
    const other = await makeActor(adminActor());
    const ready = await f.createEvent(db, { organizerId: actor.id, name: "Hazır Gece" });
    const bare = await f.createEvent(db, { organizerId: actor.id, name: "Boş Gece" });
    await f.createEvent(db, { organizerId: other.id, name: "Başkasının" });
    await f.createTable(db, ready.id);
    await f.createTable(db, ready.id);
    const person = await f.createStaff(db);
    await f.createAssignment(db, { eventId: ready.id, staffId: person.id });

    const board = await listEventBoard(db, actor, {});
    expect(board.map((e) => e.name).sort()).toEqual(["Başkasının", "Boş Gece", "Hazır Gece"]);
    const byName = Object.fromEntries(board.map((e) => [e.name, e]));
    expect(byName["Hazır Gece"]).toMatchObject({ tableCount: 2, assignmentCount: 1, reservationCount: 0 });
    expect(byName["Boş Gece"]).toMatchObject({ tableCount: 0, assignmentCount: 0 });

    const searched = await listEventBoard(db, actor, { search: "boş" });
    expect(searched.map((e) => e.id)).toEqual([bare.id]);

    const detail = await getEvent(db, actor, ready.id);
    expect(detail).toMatchObject({ tableCount: 2, assignmentCount: 1 });
  });
});

describe("listEventBoard aşama ve sanatçı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("planlama aşamasını ve sanatçı adını döner", async () => {
    const actor = await makeActor();
    const staged = await f.createEvent(db, { organizerId: actor.id, name: "Aşamalı", artistName: "Sezen Aksu" });
    await setStage(db, staged.id, "priced");
    await f.createEvent(db, { organizerId: actor.id, name: "Yeni" });

    const byName = Object.fromEntries((await listEventBoard(db, actor, {})).map((e) => [e.name, e]));
    expect(byName["Aşamalı"]).toMatchObject({ planningStage: "priced", artistName: "Sezen Aksu" });
    expect(byName["Yeni"]).toMatchObject({ planningStage: "defined", artistName: null });
  });
});
