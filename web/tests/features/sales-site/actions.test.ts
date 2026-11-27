import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventSiteContent } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { salesSiteActionDefs } from "@/features/sales-site/action-defs";
import { createAction } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";

type Result = { ok: boolean; code?: string; message?: string; data?: unknown; fieldErrors?: Record<string, string[]> };

function run(key: keyof typeof salesSiteActionDefs, actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(salesSiteActionDefs[key] as never) as (raw: unknown) => Promise<Result>;
}

describe("sales-site actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("Entertainment yöneticisi içeriği kaydeder", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    const event = await createEvent(db);
    const res = await run("saveContent", ent)({
      eventId: event.id,
      summary: "Gala",
      doorsOpenAt: "",
      ageLimit: "18+",
      dressCode: "",
      sightlineSet: "diamond",
    });
    expect(res).toEqual({ ok: true, data: { eventId: event.id } });
  });

  it("F&B ve Casino yöneticisi üç eylemi de yapamaz", async () => {
    const event = await createEvent(db);
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer();
    const form = new FormData();
    form.set("eventId", event.id);
    form.set("slot", "cover");
    form.set("file", new File([new Uint8Array(png)], "a.png", { type: "image/png" }));

    for (const dept of ["fnb", "casino"] as const) {
      const m = await persistActor(db, managerActor(dept));
      expect(await run("saveContent", m)({ eventId: event.id, summary: "X" })).toMatchObject({
        ok: false,
        code: "forbidden",
      });
      expect(await run("uploadImage", m)(form)).toMatchObject({ ok: false, code: "forbidden" });
      expect(await run("removeImage", m)({ eventId: event.id, slot: "cover" })).toMatchObject({
        ok: false,
        code: "forbidden",
      });
    }
    expect(await db.select().from(eventSiteContent)).toHaveLength(0);
  });

  it("oturumsuz çağrı unauthenticated", async () => {
    const event = await createEvent(db);
    expect(await run("saveContent", null)({ eventId: event.id })).toMatchObject({
      ok: false,
      code: "unauthenticated",
    });
  });

  it("dosyasız ya da geçersiz slot'lu form invalid", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    const event = await createEvent(db);

    const badSlot = new FormData();
    badSlot.set("eventId", event.id);
    badSlot.set("slot", "logo");
    badSlot.set("file", new File(["x"], "a.png", { type: "image/png" }));
    expect(await run("uploadImage", ent)(badSlot)).toMatchObject({ ok: false, code: "invalid" });

    const noFile = new FormData();
    noFile.set("eventId", event.id);
    noFile.set("slot", "cover");
    expect(await run("uploadImage", ent)(noFile)).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { file: expect.any(Array) },
    });
  });

  it("geçersiz kapı saati alan hatası döner", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    const event = await createEvent(db);
    expect(await run("saveContent", ent)({ eventId: event.id, doorsOpenAt: "abc" })).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { doorsOpenAt: expect.any(Array) },
    });
  });
});
