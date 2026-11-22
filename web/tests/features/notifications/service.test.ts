import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { notificationReads, notifications } from "@/db/schema";
import {
  createNotification,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  visibleTargetRoles,
} from "@/features/notifications/service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, expectForbidden, makeActor } from "../reviews/helpers";

type Target = "all" | "admin" | "leader" | "staff";

async function seed(targetRole: Target, title = `Bildirim ${targetRole}`, extra: Partial<typeof notifications.$inferInsert> = {}) {
  return insertNotification(db, { type: "system_announcement", title, message: "Metin", targetRole, ...extra });
}

describe("hedef rol görünürlüğü", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("visibleTargetRoles", () => {
    expect(visibleTargetRoles("admin")).toEqual(["all", "admin"]);
    expect(visibleTargetRoles("leader")).toEqual(["all", "leader"]);
    expect(visibleTargetRoles("staff")).toEqual(["all", "staff"]);
    expect(visibleTargetRoles("organizer")).toEqual(["all"]);
    expect(visibleTargetRoles("controller")).toEqual(["all"]);
  });

  it("her rol yalnızca kendine ve herkese giden bildirimleri görür", async () => {
    await seed("all");
    await seed("admin");
    await seed("leader");
    await seed("staff");
    const titles = async (role: "admin" | "leader" | "organizer") =>
      (await listNotifications(db, await makeActor(role), {})).items.map((n) => n.targetRole).sort();

    expect(await titles("admin")).toEqual(["admin", "all"]);
    expect(await titles("leader")).toEqual(["all", "leader"]);
    expect(await titles("organizer")).toEqual(["all"]);
  });

  it("etkin olmayan bildirim listelenmez", async () => {
    const n = await seed("all");
    await db.update(notifications).set({ isActive: false }).where(eq(notifications.id, n.id));
    const admin = await makeActor("admin");
    expect((await listNotifications(db, admin, {})).items).toHaveLength(0);
  });

  it("staff ve venue_owner rolleri bildirim modülüne erişemez", async () => {
    await expectForbidden(listNotifications(db, await makeActor("staff"), {}));
    await expectForbidden(listNotifications(db, await makeActor("venue_owner"), {}));
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

  it("görünmeyen (başka role giden) ya da olmayan bildirim not_found", async () => {
    const n = await seed("admin");
    const leader = await makeActor("leader");
    await expectDomain(markNotificationRead(db, leader, { id: n.id }), "not_found");
    await expectDomain(markNotificationRead(db, leader, { id: "00000000-0000-4000-8000-000000000000" }), "not_found");
    expect(await db.select().from(notificationReads)).toHaveLength(0);
  });

  it("tümünü okundu işaretler; yalnızca görünenleri ve yalnızca kendisi için", async () => {
    await seed("all");
    await seed("leader");
    await seed("admin");
    const leader = await makeActor("leader");
    const admin = await makeActor("admin");

    const res = await markAllNotificationsRead(db, leader);
    expect(res.marked).toBe(2);
    expect((await listNotifications(db, leader, {})).unreadCount).toBe(0);
    expect((await listNotifications(db, admin, {})).unreadCount).toBe(2);

    expect((await markAllNotificationsRead(db, leader)).marked).toBe(0);
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

  it("admin hedef rol için duyuru oluşturur; oluşturulan satır döner", async () => {
    const admin = await makeActor("admin");
    const row = await createNotification(db, admin, {
      title: "Bakım",
      message: "Gece bakım var",
      priority: "high",
      targetRole: "leader",
      actionUrl: "/leader/reviews",
    });
    expect(row).toMatchObject({
      type: "system_announcement",
      targetRole: "leader",
      priority: "high",
      createdById: admin.id,
      isActive: true,
      actionUrl: "/leader/reviews",
    });
    const leader = await makeActor("leader");
    expect((await listNotifications(db, leader, {})).items.map((n) => n.id)).toContain(row.id);
  });

  it("lider oluşturamaz", async () => {
    await expectForbidden(
      createNotification(db, await makeActor("leader"), { title: "X", message: "Y", priority: "low", targetRole: "all" }),
    );
    expect(await db.select().from(notifications)).toHaveLength(0);
  });

  it("etkinlik verilirse bağlanır; olmayan etkinlik not_found", async () => {
    const admin = await makeActor("admin");
    const event = await f.createEvent(db);
    const row = await createNotification(db, admin, {
      title: "X",
      message: "Y",
      priority: "low",
      targetRole: "all",
      eventId: event.id,
    });
    expect(row.eventId).toBe(event.id);
    await expectDomain(
      createNotification(db, admin, {
        title: "X",
        message: "Y",
        priority: "low",
        targetRole: "all",
        eventId: "00000000-0000-4000-8000-000000000000",
      }),
      "not_found",
    );
  });
});
