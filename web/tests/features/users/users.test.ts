import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, sessions, userPermissions, users } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/auth";
import { ForbiddenError } from "@/features/auth/errors";
import { loadMemberships, loadPermissions } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { getActorFromHeaders, type Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import {
  createUserSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  setPermissionsSchema,
} from "@/features/users/schemas";
import { getUserDetail, listUsers } from "@/features/users/queries";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  setUserPermissions,
  updateUser,
} from "@/features/users/service";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createUser as insertUser } from "../../helpers/factories";
import { PASSWORD, signedInCookie, signIn } from "../auth/helpers";

/** Yeni kullanıcı için geçerli en küçük erişim: `user` rolü + tek departman üyeliği, izinsiz. */
const USER_ACCESS = {
  role: "user" as const,
  memberships: [{ department: "fnb" as const, level: "member" as const }],
  permissions: [],
};

const NEW_PASSWORD = "YepYeniParola!2025";

async function actorOf(role: Actor["role"], extra: Partial<typeof users.$inferInsert> = {}): Promise<Actor> {
  const u = await insertUser(db, { role, ...extra });
  return { id: u.id, username: u.username, role: u.role, staffId: null, memberships: [], permissions: [] };
}

const FNB_MEMBER = [{ department: "fnb" as const, level: "member" as const }];
const validCreate = { username: "ayse", password: PASSWORD, ...USER_ACCESS };

async function sessionCount(userId: string): Promise<number> {
  return (await db.select().from(sessions).where(eq(sessions.userId, userId))).length;
}

describe("kullanıcı oluşturma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("admin kullanıcı oluşturur; kullanıcı girebilir, parola hash olarak saklanır", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, { ...validCreate, email: "Ayse@Example.com" });

    expect(created).toMatchObject({ username: "ayse", role: "user", email: "ayse@example.com", isActive: true });
    expect(JSON.stringify(created)).not.toContain(PASSWORD);

    const [account] = await db.select().from(accounts).where(eq(accounts.userId, created.id));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toMatch(/^\$2[aby]\$/);
    expect(account?.password).not.toContain(PASSWORD);

    expect((await signIn("ayse", PASSWORD)).status).toBe(200);
  });

  it("e-posta verilmezse yer tutucu kullanılır", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, validCreate);
    expect(created.email).toBe("ayse@eventflow.invalid");
  });

  it("admin olmayan kullanıcı oluşturamaz", async () => {
    const others = [await actorOf("user"), await persistActor(db, managerActor("entertainment"))];
    for (const actor of others) {
      await expect(createUser(db, actor, validCreate)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
  });

  it("yinelenen kullanıcı adı ve e-posta conflict olur, yetim kayıt kalmaz", async () => {
    const admin = await actorOf("admin");
    await createUser(db, admin, { ...validCreate, email: "a@example.com" });

    await expect(createUser(db, admin, { ...validCreate, email: "b@example.com" })).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(
      createUser(db, admin, { ...validCreate, username: "veli", email: "A@example.com" }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await db.select().from(users).where(eq(users.username, "veli"))).toHaveLength(0);
  });

  it("şema: kısa parola, boşluklu ve boş kullanıcı adı, bilinmeyen rol reddedilir", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(MIN_PASSWORD_LENGTH);
    expect(createUserSchema.safeParse({ ...validCreate, password: "kisa" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...validCreate, username: " ayse" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...validCreate, username: "" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...validCreate, role: "root" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...validCreate, email: "gecersiz" }).success).toBe(false);
    expect(createUserSchema.safeParse(validCreate).success).toBe(true);
  });
});

describe("pasifleştirme ve son admin", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("son aktif admin pasifleştirilemez", async () => {
    // actor: etkin olmayan (oturumu düşmemiş) başka bir admin; hedef tek aktif admin.
    const lastAdmin = await actorOf("admin");
    const stale = await actorOf("admin", { isActive: false });
    await expect(setUserActive(db, stale, { id: lastAdmin.id, active: false })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("Son sistem") as string,
    });
    const [row] = await db.select().from(users).where(eq(users.id, lastAdmin.id));
    expect(row?.isActive).toBe(true);
  });

  it("admin kendini pasifleştiremez", async () => {
    const admin = await actorOf("admin");
    await actorOf("admin");
    await expect(setUserActive(db, admin, { id: admin.id, active: false })).rejects.toBeInstanceOf(DomainError);
    const [row] = await db.select().from(users).where(eq(users.id, admin.id));
    expect(row?.isActive).toBe(true);
  });

  it("pasifleştirme oturumları siler; yeniden etkinleştirme girişe izin verir", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, validCreate);
    const cookie = await signedInCookie("ayse");
    expect(await sessionCount(created.id)).toBe(1);

    await setUserActive(db, admin, { id: created.id, active: false });
    expect(await sessionCount(created.id)).toBe(0);
    expect(await getActorFromHeaders(new Headers({ cookie }))).toBeNull();
    expect((await signIn("ayse", PASSWORD)).status).not.toBe(200);

    await setUserActive(db, admin, { id: created.id, active: true });
    expect((await signIn("ayse", PASSWORD)).status).toBe(200);
  });

  it("iki admin birbirini eşzamanlı pasifleştirirse en az biri aktif kalır", async () => {
    const a = await actorOf("admin");
    const b = await actorOf("admin");
    const results = await Promise.allSettled([
      setUserActive(db, a, { id: b.id, active: false }),
      setUserActive(db, b, { id: a.id, active: false }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const active = await db.select().from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    expect(active).toHaveLength(1);
  });

  it("admin olmayan kullanıcı pasifleştiremez", async () => {
    const organizer = await persistActor(db, managerActor("entertainment"));
    const target = await actorOf("user");
    await expect(setUserActive(db, organizer, { id: target.id, active: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("olmayan kullanıcı not_found olur", async () => {
    const admin = await actorOf("admin");
    await expect(
      setUserActive(db, admin, { id: "00000000-0000-4000-8000-000000000000", active: false }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("kullanıcı güncelleme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rol ve profil alanlarını günceller", async () => {
    const admin = await actorOf("admin");
    const target = await actorOf("user");
    const updated = await updateUser(db, admin, { id: target.id, role: "admin", name: "Yeni Ad", phone: "555" });
    expect(updated).toMatchObject({ role: "admin", name: "Yeni Ad", phone: "555" });
  });

  it("son aktif adminin rolü düşürülemez; ikinci admin varken düşürülebilir", async () => {
    const admin = await actorOf("admin");
    await expect(updateUser(db, admin, { id: admin.id, role: "user", memberships: FNB_MEMBER })).rejects.toMatchObject({
      code: "conflict",
    });
    const second = await actorOf("admin");
    await expect(updateUser(db, admin, { id: second.id, role: "user", memberships: FNB_MEMBER })).resolves.toMatchObject({
      role: "user",
    });
  });

  it("yinelenen e-posta conflict olur", async () => {
    const admin = await actorOf("admin");
    await actorOf("user", { email: "a@example.com" });
    const b = await actorOf("user");
    await expect(updateUser(db, admin, { id: b.id, email: "a@example.com" })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("admin olmayan güncelleyemez", async () => {
    const organizer = await persistActor(db, managerActor("entertainment"));
    const target = await actorOf("user");
    await expect(updateUser(db, organizer, { id: target.id, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("parola sıfırlama", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yeni parola geçerli olur, eski geçmez ve tüm oturumlar silinir", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, validCreate);
    await signedInCookie("ayse");
    await signedInCookie("ayse");
    expect(await sessionCount(created.id)).toBe(2);

    await resetUserPassword(db, admin, { id: created.id, password: NEW_PASSWORD });

    expect(await sessionCount(created.id)).toBe(0);
    expect((await signIn("ayse", PASSWORD)).status).not.toBe(200);
    expect((await signIn("ayse", NEW_PASSWORD)).status).toBe(200);
  });

  it("parola düz metin saklanmaz ve yanıtta dönmez", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, validCreate);
    const result = await resetUserPassword(db, admin, { id: created.id, password: NEW_PASSWORD });
    expect(JSON.stringify(result ?? null)).not.toContain(NEW_PASSWORD);
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, created.id));
    expect(account?.password).toMatch(/^\$2[aby]\$/);
  });

  it("parolası olmayan hesaba credential hesabı ekler", async () => {
    const admin = await actorOf("admin");
    const target = await actorOf("user", { username: "eski" });
    await resetUserPassword(db, admin, { id: target.id, password: NEW_PASSWORD });
    expect((await signIn("eski", NEW_PASSWORD)).status).toBe(200);
  });

  it("yalnızca admin sıfırlayabilir", async () => {
    const organizer = await persistActor(db, managerActor("entertainment"));
    const target = await actorOf("user");
    await expect(
      resetUserPassword(db, organizer, { id: target.id, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("şema: kısa parola reddedilir", () => {
    expect(resetPasswordSchema.safeParse({ id: crypto.randomUUID(), password: "kisa" }).success).toBe(false);
  });
});

describe("modül izinleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("izin satırlarını değiştirir; verilen yetki olarak okunur", async () => {
    const admin = await actorOf("admin");
    const created = await createUser(db, admin, {
      username: "uye",
      password: PASSWORD,
      role: "user",
      memberships: [
        { department: "fnb", level: "member" },
        { department: "casino", level: "member" },
      ],
      permissions: [],
    });
    const member = { ...admin, id: created.id, role: "user" as const };

    await setUserPermissions(db, admin, {
      id: created.id,
      permissions: [{ module: "venues", canView: true, canCreate: false, canEdit: false, canDelete: false }],
    });
    const rows = await loadPermissions(created.id);
    expect(rows).toHaveLength(1);
    const actor = { ...member, memberships: await loadMemberships(created.id), permissions: rows };
    expect(can(actor, "venues", "view")).toBe(true);
    expect(can(actor, "venues", "create")).toBe(false);

    await setUserPermissions(db, admin, {
      id: created.id,
      permissions: [{ module: "customers", canView: true, canCreate: true, canEdit: true, canDelete: false }],
    });
    const after = await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id));
    expect(after.map((r) => r.module)).toEqual(["customers"]);

    await setUserPermissions(db, admin, { id: created.id, permissions: [] });
    expect(await loadPermissions(created.id)).toHaveLength(0);
  });

  it("şema: yinelenen ve bilinmeyen modül reddedilir", () => {
    const id = crypto.randomUUID();
    const row = { canView: true, canCreate: false, canEdit: false, canDelete: false };
    expect(
      setPermissionsSchema.safeParse({ id, permissions: [{ module: "events", ...row }, { module: "events", ...row }] })
        .success,
    ).toBe(false);
    for (const mod of ["users", "settings"]) {
      expect(setPermissionsSchema.safeParse({ id, permissions: [{ module: mod, ...row }] }).success).toBe(false);
    }
    expect(setPermissionsSchema.safeParse({ id, permissions: [{ module: "reviews", ...row }] }).success).toBe(true);
  });

  it("admin olmayan izin değiştiremez", async () => {
    const organizer = await persistActor(db, managerActor("entertainment"));
    await expect(setUserPermissions(db, organizer, { id: organizer.id, permissions: [] })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("sorgular", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("listUsers parola/hash döndürmez ve yetki ister", async () => {
    const admin = await actorOf("admin");
    await createUser(db, admin, validCreate);
    const list = await listUsers(db, admin);
    expect(list.map((u) => u.username).sort()).toContain("ayse");
    const json = JSON.stringify(list);
    expect(json).not.toContain("$2");
    expect(json).not.toContain("password");

    await expect(listUsers(db, await persistActor(db, managerActor("entertainment")))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("getUserDetail izin satırlarını içerir; olmayan kullanıcı null döner", async () => {
    const admin = await actorOf("admin");
    const target = await createUser(db, admin, {
      ...validCreate,
      memberships: [{ department: "entertainment", level: "member" }],
      permissions: [],
    });
    await setUserPermissions(db, admin, {
      id: target.id,
      permissions: [{ module: "events", canView: true, canCreate: true, canEdit: false, canDelete: false }],
    });
    const detail = await getUserDetail(db, admin, target.id);
    expect(detail?.permissions).toHaveLength(1);
    expect(detail?.memberships).toEqual([{ department: "entertainment", level: "member" }]);
    expect(await getUserDetail(db, admin, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
