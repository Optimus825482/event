import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { notificationReads, notifications } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { notificationActionDefs } from "@/features/notifications/action-defs";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { adminActor, managerActor, memberActor, persistActor } from "../../helpers/actors";
import { makeActor } from "../reviews/helpers";

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    create: defineAction(notificationActionDefs.create),
    markRead: defineAction(notificationActionDefs.markRead),
    markAllRead: defineAction(notificationActionDefs.markAllRead),
  };
}

const valid = { title: "Duyuru", message: "Metin", priority: "medium", audience: "all" };

describe("notifications actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oturumsuz unauthenticated", async () => {
    expect(await actionsFor(null).create(valid)).toMatchObject({ ok: false, code: "unauthenticated" });
  });

  it("F&B yöneticisi oluşturamaz (forbidden), admin oluşturur", async () => {
    const fnbManager = await persistActor(db, managerActor("fnb"));
    expect(await actionsFor(fnbManager).create(valid)).toMatchObject({ ok: false, code: "forbidden" });
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

  it("geçersiz hedef kitle invalid", async () => {
    for (const audience of ["controller", "leader", "staff"]) {
      const res = await actionsFor(await makeActor("admin")).create({ ...valid, audience });
      expect(res).toMatchObject({ ok: false, code: "invalid" });
      if (!res.ok) expect(res.fieldErrors?.audience).toEqual(["Geçersiz hedef kitle"]);
    }
  });

  it("F&B kullanıcısı kendi kitlesini okundu işaretler, Casino kitlesini işaretleyemez", async () => {
    const admin = actionsFor(await makeActor(adminActor()));
    const created = await admin.create({ ...valid, audience: "fnb" });
    const casino = await admin.create({ ...valid, audience: "casino" });
    await admin.create({ ...valid, audience: "all" });
    if (!created.ok || !casino.ok) throw new Error("oluşturulamadı");

    const fnb = actionsFor(await persistActor(db, memberActor("fnb", { notifications: "v---" })));
    expect(await fnb.markRead({ id: casino.data.id })).toMatchObject({ ok: false, code: "not_found" });
    expect((await fnb.markRead({ id: created.data.id })).ok).toBe(true);
    expect(await fnb.markAllRead({})).toMatchObject({ ok: true, data: { marked: 1 } });
    expect(await db.select().from(notificationReads)).toHaveLength(2);
  });

  it("geçersiz kimlik invalid", async () => {
    const res = await actionsFor(await persistActor(db, memberActor("fnb", { notifications: "v---" }))).markRead({ id: "x" });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
  });
});
