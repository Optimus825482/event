import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { notificationReads, notifications } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { notificationActionDefs } from "@/features/notifications/action-defs";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { makeActor } from "../reviews/helpers";

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    create: defineAction(notificationActionDefs.create),
    markRead: defineAction(notificationActionDefs.markRead),
    markAllRead: defineAction(notificationActionDefs.markAllRead),
  };
}

const valid = { title: "Duyuru", message: "Metin", priority: "medium", targetRole: "all" };

describe("notifications actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oturumsuz unauthenticated", async () => {
    expect(await actionsFor(null).create(valid)).toMatchObject({ ok: false, code: "unauthenticated" });
  });

  it("lider oluşturamaz (forbidden), admin oluşturur", async () => {
    expect(await actionsFor(await makeActor("leader")).create(valid)).toMatchObject({ ok: false, code: "forbidden" });
    const res = await actionsFor(await makeActor("admin")).create(valid);
    expect(res.ok).toBe(true);
    expect(await db.select().from(notifications)).toHaveLength(1);
  });

  it("boş başlık ve dış bağlantı alan hatası verir", async () => {
    const admin = actionsFor(await makeActor("admin"));
    const empty = await admin.create({ ...valid, title: "  " });
    expect(empty).toMatchObject({ ok: false, code: "invalid" });
    if (!empty.ok) expect(empty.fieldErrors?.title?.length).toBeGreaterThan(0);

    for (const url of ["https://kotu.example/x", "//kotu.example", "javascript:alert(1)"]) {
      const res = await admin.create({ ...valid, actionUrl: url });
      expect(res).toMatchObject({ ok: false, code: "invalid" });
      if (!res.ok) expect(res.fieldErrors?.actionUrl?.length).toBeGreaterThan(0);
    }
    expect((await admin.create({ ...valid, actionUrl: "/notifications" })).ok).toBe(true);
  });

  it("geçersiz hedef rol invalid", async () => {
    const res = await actionsFor(await makeActor("admin")).create({ ...valid, targetRole: "controller" });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
  });

  it("lider okundu işaretler; tümünü okundu işaretler", async () => {
    const admin = actionsFor(await makeActor("admin"));
    const created = await admin.create({ ...valid, targetRole: "leader" });
    await admin.create({ ...valid, targetRole: "all" });
    if (!created.ok) throw new Error("oluşturulamadı");

    const leader = actionsFor(await makeActor("leader"));
    expect((await leader.markRead({ id: created.data.id })).ok).toBe(true);
    expect(await leader.markAllRead({})).toMatchObject({ ok: true, data: { marked: 1 } });
    expect(await db.select().from(notificationReads)).toHaveLength(2);
  });

  it("geçersiz kimlik invalid", async () => {
    const res = await actionsFor(await makeActor("leader")).markRead({ id: "x" });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
  });
});
