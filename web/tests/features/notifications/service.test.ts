import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { notificationReads, notifications } from "@/db/schema";
import { can } from "@/features/auth/policy";
import {
  createNotification,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  visibleAudiences,
} from "@/features/notifications/service";
import {
  adminActor,
  assistantActor,
  managerActor,
  memberActor,
  noAccessActor,
  persistActor,
} from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, expectForbidden, makeActor } from "../reviews/helpers";

type Target = "all" | "admin" | "entertainment" | "fnb" | "casino";

async function seed(audience: Target, title = `Bildirim ${audience}`, extra: Partial<typeof notifications.$inferInsert> = {}) {
  return insertNotification(db, { type: "system_announcement", title, message: "Metin", audience, ...extra });
}

const fnbUser = () => persistActor(db, memberActor("fnb", { notifications: "v---" }));
const audiencesSeenBy = async (actor: Awaited<ReturnType<typeof fnbUser>>) =>
  (await listNotifications(db, actor, {})).items.map((n) => n.audience).sort();

describe("hedef kitle görünürlüğü", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("visibleAudiences", () => {
    expect(visibleAudiences(adminActor())).toEqual(["all", "admin", "entertainment", "fnb", "casino"]);
    expect(visibleAudiences(managerActor("fnb"))).toEqual(["all", "fnb"]);
    expect(visibleAudiences(noAccessActor())).toEqual(["all"]);
  });

  it("iki departmanlı kullanıcı iki kitlenin bildirimini de görür; her bildirim bir kez gelir", async () => {
    await seed("all");
    await seed("admin");
    await seed("entertainment");
    await seed("fnb");
    await seed("casino");
    const actor = await persistActor(
      db,
      memberActor("fnb", { notifications: "v---" }, {
        memberships: [
          { department: "fnb", level: "member" },
          { department: "casino", level: "assistant" },
        ],
      }),
    );
    expect(visibleAudiences(actor)).toEqual(["all", "fnb", "casino"]);
    const res = await listNotifications(db, actor, {});
    expect(res.items.map((n) => n.audience).sort()).toEqual(["all", "casino", "fnb"]);
    expect(res.total).toBe(3);
    expect(res.unreadCount).toBe(3);
  });

  it("Casino'ya gönderilen bildirim F&B kullanıcısının listesinde ve okunmamış sayısında yoktur", async () => {
    await seed("casino");
    await seed("fnb");
    const user = await fnbUser();
    const res = await listNotifications(db, user, {});
    expect(res.items.map((n) => n.audience)).toEqual(["fnb"]);
    expect(res.total).toBe(1);
    expect(res.unreadCount).toBe(1);
  });

  it("admin tüm kitlelerin bildirimini görür", async () => {
    for (const a of ["all", "admin", "entertainment", "fnb", "casino"] as const) await seed(a);
    expect(await audiencesSeenBy(await persistActor(db, adminActor()))).toEqual([
      "admin",
      "all",
      "casino",
      "entertainment",
      "fnb",
    ]);
  });

  it("departmanı olmayan kullanıcı yalnızca herkese giden kitleyi görür (tavan yok: liste de yasak)", async () => {
    const actor = await persistActor(db, noAccessActor());
    expect(visibleAudiences(actor)).toEqual(["all"]);
    await expectForbidden(listNotifications(db, actor, {}));
  });

  it("etkin olmayan bildirim listelenmez", async () => {
    const n = await seed("all");
    await db.update(notifications).set({ isActive: false }).where(eq(notifications.id, n.id));
    const admin = await makeActor("admin");
    expect((await listNotifications(db, admin, {})).items).toHaveLength(0);
  });

  it("bildirim izni olmayan kullanıcılar bildirim modülüne erişemez", async () => {
    await expectForbidden(listNotifications(db, await makeActor(memberActor("casino", { reservations: "vced" })), {}));
    await expectForbidden(listNotifications(db, await makeActor(memberActor("fnb", { venues: "vced" })), {}));
    await expectForbidden(listNotifications(db, await persistActor(db, noAccessActor()), {}));
  });
});

describe("okundu işaretleme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("liste okunmamış sayısını ve isRead durumunu kullanıcıya göre verir", async () => {
    const a = await seed("all", "A");
    await seed("all", "B");
    const admin = await makeActor("admin");
    const other = await makeActor("admin");
    await markNotificationRead(db, admin, { id: a.id });

    const mine = await listNotifications(db, admin, {});
    expect(mine.unreadCount).toBe(1);
    expect(mine.items.find((n) => n.title === "A")?.isRead).toBe(true);
    expect(mine.items.find((n) => n.title === "B")?.isRead).toBe(false);

    const theirs = await listNotifications(db, other, {});
    expect(theirs.unreadCount).toBe(2);
  });

  it("tekrar okundu işaretleme hata vermez, tek satır kalır", async () => {
    const n = await seed("all");
    const admin = await makeActor("admin");
    await markNotificationRead(db, admin, { id: n.id });
    await markNotificationRead(db, admin, { id: n.id });
    await Promise.all([markNotificationRead(db, admin, { id: n.id }), markNotificationRead(db, admin, { id: n.id })]);
    expect(await db.select().from(notificationReads)).toHaveLength(1);
  });

  it("görünmeyen (başka kitleye giden) ya da olmayan bildirim not_found", async () => {
    const casinoNote = await seed("casino");
    const adminNote = await seed("admin");
    const user = await fnbUser();
    await expectDomain(markNotificationRead(db, user, { id: casinoNote.id }), "not_found");
    await expectDomain(markNotificationRead(db, user, { id: adminNote.id }), "not_found");
    await expectDomain(markNotificationRead(db, user, { id: "00000000-0000-4000-8000-000000000000" }), "not_found");
    expect(await db.select().from(notificationReads)).toHaveLength(0);
  });

  it("tümünü okundu işaretler; yalnızca görünenleri ve yalnızca kendisi için", async () => {
    await seed("all");
    await seed("fnb");
    await seed("casino");
    await seed("admin");
    const user = await fnbUser();
    const admin = await persistActor(db, adminActor());

    const res = await markAllNotificationsRead(db, user);
    expect(res.marked).toBe(2);
    expect((await listNotifications(db, user, {})).unreadCount).toBe(0);
    expect((await listNotifications(db, admin, {})).unreadCount).toBe(4);

    expect((await markAllNotificationsRead(db, user)).marked).toBe(0);
  });

  it("okunmamışlar süzgeci ve sayfalama", async () => {
    const admin = await makeActor("admin");
    const made = [];
    for (let i = 1; i <= 5; i += 1) made.push(await seed("all", `N${i}`));
    await markNotificationRead(db, admin, { id: made[4]?.id ?? "" });

    const unread = await listNotifications(db, admin, { unreadOnly: true });
    expect(unread.total).toBe(4);
    expect(unread.items.every((n) => !n.isRead)).toBe(true);

    const page1 = await listNotifications(db, admin, { page: 1, pageSize: 2 });
    const page3 = await listNotifications(db, admin, { page: 3, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page3.items).toHaveLength(1);
    expect(page1.total).toBe(5);
    // En yeni önce.
    expect(page1.items[0]?.title).toBe("N5");
  });
});

describe("createNotification", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("admin hedef kitle için duyuru oluşturur; oluşturulan satır döner", async () => {
    const admin = await makeActor("admin");
    const row = await createNotification(db, admin, {
      title: "Bakım",
      message: "Gece bakım var",
      priority: "high",
      audience: "fnb",
      actionUrl: "/events",
    });
    expect(row).toMatchObject({
      type: "system_announcement",
      audience: "fnb",
      priority: "high",
      createdById: admin.id,
      isActive: true,
      actionUrl: "/events",
    });
    const fnb = await fnbUser();
    expect((await listNotifications(db, fnb, {})).items.map((n) => n.id)).toContain(row.id);
    const casino = await persistActor(db, memberActor("casino", { notifications: "v---" }));
    expect((await listNotifications(db, casino, {})).items.map((n) => n.id)).not.toContain(row.id);
  });

  it("Entertainment asistanı bildirim oluşturur ama silemez", async () => {
    const assistant = await persistActor(db, assistantActor("entertainment"));
    const row = await createNotification(db, assistant, { title: "X", message: "Y", priority: "low", audience: "casino" });
    expect(row.audience).toBe("casino");
    expect(can(assistant, "notifications", "create")).toBe(true);
    expect(can(assistant, "notifications", "delete")).toBe(false);
  });

  it("F&B ve Casino yöneticileri yalnızca görüntüler, oluşturamaz", async () => {
    for (const department of ["fnb", "casino"] as const) {
      const manager = await persistActor(db, managerActor(department));
      await expectForbidden(createNotification(db, manager, { title: "X", message: "Y", priority: "low", audience: "all" }));
    }
    expect(await db.select().from(notifications)).toHaveLength(0);
  });

  it("etkinlik verilirse bağlanır; olmayan etkinlik not_found", async () => {
    const admin = await makeActor("admin");
    const event = await f.createEvent(db);
    const row = await createNotification(db, admin, {
      title: "X",
      message: "Y",
      priority: "low",
      audience: "all",
      eventId: event.id,
    });
    expect(row.eventId).toBe(event.id);
    await expectDomain(
      createNotification(db, admin, {
        title: "X",
        message: "Y",
        priority: "low",
        audience: "all",
        eventId: "00000000-0000-4000-8000-000000000000",
      }),
      "not_found",
    );
  });
});
