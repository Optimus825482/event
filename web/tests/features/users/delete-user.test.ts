import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, events, sessions, staffPerformanceReviews, userPermissions, users } from "@/db/schema";
import { DEPARTMENTS } from "@/features/auth/departments";
import { ForbiddenError } from "@/features/auth/errors";
import { getActorFromHeaders, type Actor } from "@/features/auth/session";
import { createAction } from "@/lib/action";
import { userActionDefs } from "@/features/users/action-defs";
import { isDeletedAccount } from "@/features/users/filter";
import { createUser, deleteUser, resetUserPassword, setUserActive, setUserPermissions, updateUser } from "@/features/users/service";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent, createStaff, createUser as insertUser } from "../../helpers/factories";
import { PASSWORD, signedInCookie, signIn } from "../auth/helpers";

/** Yeni kullanıcı için geçerli en küçük erişim: `user` rolü + tek departman üyeliği, izinsiz. */
const USER_ACCESS = {
  role: "user" as const,
  memberships: [{ department: "fnb" as const, level: "member" as const }],
  permissions: [],
};

async function actorOf(role: Actor["role"]): Promise<Actor> {
  const u = await insertUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: null, memberships: [], permissions: [] };
}

async function rowOf(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

describe("kullanıcı silme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("başvurusu olmayan kullanıcı kalıcı silinir; oturum, parola hesabı ve izinler gider", async () => {
    const admin = await actorOf("admin");
    const target = await createUser(db, admin, { username: "silinecek", password: PASSWORD, ...USER_ACCESS });
    await setUserPermissions(db, admin, {
      id: target.id,
      permissions: [{ module: "venues", canView: true, canCreate: false, canEdit: false, canDelete: false }],
    });
    const cookie = await signedInCookie("silinecek");

    await expect(deleteUser(db, admin, { id: target.id })).resolves.toEqual({ id: target.id, mode: "deleted" });

    expect(await rowOf(target.id)).toBeUndefined();
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toHaveLength(0);
    expect(await db.select().from(accounts).where(eq(accounts.userId, target.id))).toHaveLength(0);
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, target.id))).toHaveLength(0);
    expect(await getActorFromHeaders(new Headers({ cookie }))).toBeNull();
    expect((await signIn("silinecek", PASSWORD)).status).not.toBe(200);
  });

  it("etkinlik sahibi kullanıcı anonimleştirilir; etkinlik bozulmaz, giriş yapamaz", async () => {
    const admin = await actorOf("admin");
    const staffRow = await createStaff(db);
    const target = await createUser(db, admin, {
      username: "organizator",
      password: PASSWORD,
      ...USER_ACCESS,
      email: "org@example.com",
      name: "Org Kişi",
      staffId: staffRow.id,
    });
    await db.update(users).set({ phone: "05550000000", image: "data:image/png;base64,AAAA" }).where(eq(users.id, target.id));
    const event = await createEvent(db, { organizerId: target.id });
    const cookie = await signedInCookie("organizator");

    await expect(deleteUser(db, admin, { id: target.id })).resolves.toEqual({ id: target.id, mode: "anonymized" });

    const row = await rowOf(target.id);
    expect(row).toMatchObject({
      name: "Silinmiş kullanıcı",
      username: `silinmis-${target.id}`,
      role: "user",
      isActive: false,
      staffId: null,
      phone: null,
      image: null,
    });
    expect(row?.email).not.toContain("org@example.com");
    expect(row && isDeletedAccount(row)).toBe(true);
    const [kept] = await db.select().from(events).where(eq(events.id, event.id));
    expect(kept?.organizerId).toBe(target.id);
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toHaveLength(0);
    expect(await db.select().from(accounts).where(eq(accounts.userId, target.id))).toHaveLength(0);
    expect(await getActorFromHeaders(new Headers({ cookie }))).toBeNull();
    expect((await signIn("organizator", PASSWORD)).status).not.toBe(200);
    // Silinmiş hesap yeniden etkinleştirilemez.
    await expect(setUserActive(db, admin, { id: target.id, active: true })).rejects.toMatchObject({ code: "conflict" });
    expect((await rowOf(target.id))?.isActive).toBe(false);
    // Kullanıcı adı serbest kalır; aynı adla yeni hesap açılabilir.
    await expect(
      createUser(db, admin, { username: "organizator", password: PASSWORD, ...USER_ACCESS, email: "org@example.com" }),
    ).resolves.toMatchObject({ username: "organizator" });
  });

  it("değerlendiren olarak anılan kullanıcı anonimleştirilir", async () => {
    const admin = await actorOf("admin");
    const reviewer = await actorOf("user");
    const event = await createEvent(db);
    const staffRow = await createStaff(db);
    await db
      .insert(staffPerformanceReviews)
      .values({ staffId: staffRow.id, reviewerId: reviewer.id, eventId: event.id, score: 80, rating: "average" });
    await expect(deleteUser(db, admin, { id: reviewer.id })).resolves.toMatchObject({ mode: "anonymized" });
    expect(await db.select().from(staffPerformanceReviews)).toHaveLength(1);
  });

  it("kendini silemez", async () => {
    const admin = await actorOf("admin");
    await actorOf("admin");
    await expect(deleteUser(db, admin, { id: admin.id })).rejects.toMatchObject({ code: "conflict" });
    expect(await rowOf(admin.id)).toBeDefined();
  });

  it("son yönetici silinemez; ikinci aktif yönetici varken silinebilir", async () => {
    const lastAdmin = await actorOf("admin");
    // Eski oturum: rolü düşürülmüş ama önbellekte admin görünen aktör.
    const stale = await actorOf("user");
    const staleAdmin: Actor = { ...stale, role: "admin" };
    await expect(deleteUser(db, staleAdmin, { id: lastAdmin.id })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("Son sistem") as string,
    });
    expect(await rowOf(lastAdmin.id)).toBeDefined();

    const second = await actorOf("admin");
    await expect(deleteUser(db, second, { id: lastAdmin.id })).resolves.toMatchObject({ mode: "deleted" });
  });

  it("pasif yönetici, silen aktif yönetici varken silinebilir", async () => {
    const admin = await actorOf("admin");
    const inactiveAdmin = await insertUser(db, { role: "admin", isActive: false });
    // Silen aktör hedefin dışındaki aktif yöneticidir; sistemde yönetici kalır.
    await expect(deleteUser(db, admin, { id: inactiveAdmin.id })).resolves.toMatchObject({ mode: "deleted" });
  });

  it("yönetici olmayanlar (departman yöneticileri dahil) silemez", async () => {
    const target = await actorOf("user");
    const others = [await actorOf("user"), ...(await Promise.all(DEPARTMENTS.map((d) => persistActor(db, managerActor(d)))))];
    for (const actor of others) {
      await expect(deleteUser(db, actor, { id: target.id })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await rowOf(target.id)).toBeDefined();
  });

  it("olmayan kullanıcı not_found", async () => {
    const admin = await actorOf("admin");
    await expect(deleteUser(db, admin, { id: "00000000-0000-4000-8000-0000000000aa" })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("action: oturumsuz unauthenticated, yetkisiz forbidden, geçersiz kimlik invalid", async () => {
    const admin = await actorOf("admin");
    const target = await actorOf("user");
    const organizer = await persistActor(db, managerActor("entertainment"));

    const anon = createAction({ getActor: async () => null }).defineAction(userActionDefs.deleteUser);
    expect(await anon({ id: target.id })).toMatchObject({ ok: false, code: "unauthenticated" });

    const forbidden = createAction({ getActor: async () => organizer }).defineAction(userActionDefs.deleteUser);
    expect(await forbidden({ id: target.id })).toMatchObject({ ok: false, code: "forbidden" });

    const run = createAction({ getActor: async () => admin }).defineAction(userActionDefs.deleteUser);
    expect(await run({ id: "yok" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await run({ id: target.id })).toEqual({ ok: true, data: { id: target.id, mode: "deleted" } });
  });

  describe("silinmiş hesap değiştirilemez", () => {
    async function anonymized(admin: Actor) {
      const staffRow = await createStaff(db);
      const target = await createUser(db, admin, {
        username: "organizator",
        password: PASSWORD,
        ...USER_ACCESS,
        staffId: staffRow.id,
      });
      await createEvent(db, { organizerId: target.id });
      await expect(deleteUser(db, admin, { id: target.id })).resolves.toMatchObject({ mode: "anonymized" });
      return target;
    }

    it("updateUser, resetUserPassword ve setUserPermissions conflict ile reddedilir; satır değişmez", async () => {
      const admin = await actorOf("admin");
      const target = await anonymized(admin);
      const before = await rowOf(target.id);
      const conflict = { code: "conflict", message: "Silinmiş hesap değiştirilemez" };

      await expect(updateUser(db, admin, { id: target.id, email: "geri@example.com" })).rejects.toMatchObject(conflict);
      await expect(updateUser(db, admin, { id: target.id, name: "Yeni Ad", role: "admin" })).rejects.toMatchObject(conflict);
      await expect(resetUserPassword(db, admin, { id: target.id, password: PASSWORD })).rejects.toMatchObject(conflict);
      await expect(
        setUserPermissions(db, admin, {
          id: target.id,
          permissions: [{ module: "events", canView: true, canCreate: false, canEdit: false, canDelete: false }],
        }),
      ).rejects.toMatchObject(conflict);

      expect(await rowOf(target.id)).toEqual(before);
      expect(await db.select().from(accounts).where(eq(accounts.userId, target.id))).toHaveLength(0);
      expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, target.id))).toHaveLength(0);
      expect((await signIn("organizator", PASSWORD)).status).not.toBe(200);
    });

    it("silinmiş hesap işaretini taklit eden e-posta ve kullanıcı adı reddedilir", async () => {
      const admin = await actorOf("admin");
      const normal = await createUser(db, admin, { username: "normal", password: PASSWORD, ...USER_ACCESS });

      await expect(
        updateUser(db, admin, { id: normal.id, email: "Sahte@Silinmis.EventFlow.Invalid" }),
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(
        createUser(db, admin, { username: "yeni", password: PASSWORD, ...USER_ACCESS, email: "x@silinmis.eventflow.invalid" }),
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(
        createUser(db, admin, { username: "silinmis-123", password: PASSWORD, ...USER_ACCESS }),
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(
        createUser(db, admin, { username: "Silinmis-123", password: PASSWORD, ...USER_ACCESS }),
      ).rejects.toMatchObject({ code: "invalid" });

      expect((await rowOf(normal.id))?.email).toBe("normal@eventflow.invalid");
      expect(await db.select().from(users).where(eq(users.username, "yeni"))).toHaveLength(0);
    });
  });
});
