import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, departmentMemberships, userPermissions, users } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { createUserSchema, PERMISSION_MODULES, setMembershipsSchema } from "@/features/users/schemas";
import { getUserDetail, listUsers } from "@/features/users/queries";
import {
  createUser,
  deleteUser,
  setUserActive,
  setUserMemberships,
  setUserPermissions,
  updateUser,
} from "@/features/users/service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createUser as insertUser } from "../../helpers/factories";
import { PASSWORD } from "../auth/helpers";

const row = (module: (typeof PERMISSION_MODULES)[number], flags: string) => ({
  module,
  canView: flags.includes("v"),
  canCreate: flags.includes("c"),
  canEdit: flags.includes("e"),
  canDelete: flags.includes("d"),
});

const base = { username: "ayse", password: PASSWORD, role: "user" as const };

describe("kullanıcı oluşturma: üyelik ve izinler", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kullanıcı üyelik ve izinleriyle tek işlemde oluşturulur", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [row("venues", "vce-")],
    });
    const members = await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, created.id));
    const perms = await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id));
    expect(members).toHaveLength(1);
    expect(perms).toHaveLength(1);
    expect(perms[0]).toMatchObject({ module: "venues", canView: true, canCreate: true, canEdit: true, canDelete: false });
  });

  it("tavan dışı izin tüm oluşturmayı geri alır", async () => {
    const admin = await persistActor(db, adminActor());
    await expect(
      createUser(db, admin, {
        ...base,
        memberships: [{ department: "casino", level: "member" }],
        permissions: [row("staff", "v")],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
    expect(await db.select().from(departmentMemberships)).toHaveLength(0);
  });

  it("iki departmanlı kullanıcı oluşturulur", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [
        { department: "fnb", level: "manager" },
        { department: "casino", level: "member" },
      ],
      permissions: [row("reservations", "vc--")],
    });
    const detail = await getUserDetail(db, admin, created.id);
    expect(detail?.memberships).toHaveLength(2);
    expect(detail?.permissions).toHaveLength(1);
  });

  it("tüm bayrakları kapalı satır kaydedilmez", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "casino", level: "member" }],
      permissions: [row("reservations", "----")],
    });
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id))).toHaveLength(0);
  });

  it("user rolü üyeliksiz ve admin üyelikli oluşturulamaz", async () => {
    const admin = await persistActor(db, adminActor());
    await expect(createUser(db, admin, { ...base, memberships: [], permissions: [] })).rejects.toMatchObject({
      code: "invalid",
      message: "En az bir departman seçin",
    });
    await expect(
      createUser(db, admin, {
        ...base,
        role: "admin",
        memberships: [{ department: "fnb", level: "member" }],
        permissions: [],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
  });

  it("admin olmayan aktör kullanıcı oluşturamaz", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(
      createUser(db, actor, { ...base, memberships: [{ department: "fnb", level: "member" }], permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("şema: rol yalnızca admin/user; yinelenen departman ve modül reddedilir", () => {
    const ok = { ...base, memberships: [{ department: "fnb", level: "member" }], permissions: [] };
    expect(createUserSchema.safeParse(ok).success).toBe(true);
    expect(createUserSchema.safeParse({ ...ok, role: "staff" }).success).toBe(false);
    expect(
      createUserSchema.safeParse({
        ...ok,
        memberships: [
          { department: "fnb", level: "member" },
          { department: "fnb", level: "manager" },
        ],
      }).success,
    ).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, permissions: [row("events", "v"), row("events", "v")] }).success).toBe(
      false,
    );
    expect(PERMISSION_MODULES).toEqual([
      "events",
      "invitations",
      "notifications",
      "venues",
      "staff",
      "reviews",
      "reservations",
      "customers",
      "check_in",
    ]);
    expect(setMembershipsSchema.safeParse({ id: crypto.randomUUID(), memberships: [] }).success).toBe(true);
  });
});

describe("üyelik güncelleme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("üyelik kaldırılınca tavan dışı kalan izinler silinir", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [
        { department: "fnb", level: "member" },
        { department: "casino", level: "member" },
      ],
      permissions: [row("venues", "vce-"), row("reservations", "v---")],
    });
    await setUserMemberships(db, admin, { id: created.id, memberships: [{ department: "casino", level: "member" }] });
    const perms = await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id));
    expect(perms.map((p) => p.module)).toEqual(["reservations"]);
    const members = await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, created.id));
    expect(members.map((m) => m.department)).toEqual(["casino"]);
  });

  it("admin olmayan aktör üyelik atayamaz", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [],
    });
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(
      setUserMemberships(db, actor, { id: created.id, memberships: [{ department: "casino", level: "member" }] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("user rolü boş üyelikle bırakılamaz; admin hedefe üyelik atanamaz", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [],
    });
    await expect(setUserMemberships(db, admin, { id: created.id, memberships: [] })).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(
      setUserMemberships(db, admin, { id: admin.id, memberships: [{ department: "fnb", level: "member" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("izinler tavan dışıysa setUserPermissions reddeder ve eski satırlar kalır", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [row("venues", "v---")],
    });
    await expect(
      setUserPermissions(db, admin, { id: created.id, permissions: [row("reservations", "v")] }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id))).toHaveLength(1);
    await setUserPermissions(db, admin, { id: created.id, permissions: [row("staff", "vc--")] });
    expect(
      (await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id))).map((p) => p.module),
    ).toEqual(["staff"]);
  });

  it("admin rolüne yükseltilince üyelik ve izinler temizlenir", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [row("venues", "v---")],
    });
    await updateUser(db, admin, { id: created.id, role: "admin" });
    expect(
      await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, created.id)),
    ).toHaveLength(0);
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, created.id))).toHaveLength(0);
  });

  it("listUsers üyelikleri doldurur", async () => {
    const admin = await persistActor(db, adminActor());
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "casino", level: "assistant" }],
      permissions: [],
    });
    const list = await listUsers(db, admin);
    expect(list.find((u) => u.id === created.id)?.memberships).toEqual([{ department: "casino", level: "assistant" }]);
  });

  it("listUsers izin satırlarını da döndürür (düzenleme formu için)", async () => {
    const admin = await persistActor(db, adminActor());
    const grant = { module: "customers" as const, canView: true, canCreate: false, canEdit: true, canDelete: false };
    const created = await createUser(db, admin, {
      ...base,
      memberships: [{ department: "casino", level: "member" }],
      permissions: [grant],
    });
    const list = await listUsers(db, admin);
    expect(list.find((u) => u.id === created.id)?.permissions).toEqual([grant]);
  });
});

describe("son etkin sistem yöneticisi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("user rolüne düşürülemez / pasife alınamaz / silinemez", async () => {
    const lastAdmin = await persistActor(db, adminActor());
    // Etkin olmayan başka bir admin aktörü: hedef tek etkin admin.
    const other = await persistActor(db, adminActor());
    await db.update(users).set({ isActive: false }).where(eq(users.id, other.id));
    const msg = "Son sistem yöneticisi kaldırılamaz";
    await expect(updateUser(db, other, { id: lastAdmin.id, role: "user" })).rejects.toMatchObject({
      code: "conflict",
      message: msg,
    });
    await expect(setUserActive(db, other, { id: lastAdmin.id, active: false })).rejects.toMatchObject({
      code: "conflict",
      message: msg,
    });
    await expect(deleteUser(db, other, { id: lastAdmin.id })).rejects.toMatchObject({ code: "conflict", message: msg });
    const [r] = await db.select().from(users).where(eq(users.id, lastAdmin.id));
    expect(r).toMatchObject({ role: "admin", isActive: true });
  });
});

describe("rol değişimi ve tek işlemli yazım", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function legacyUser(role: "staff" | "organizer", rows: ReturnType<typeof row>[] = []) {
    const u = await insertUser(db, { role });
    if (rows.length > 0) await db.insert(userPermissions).values(rows.map((r) => ({ ...r, userId: u.id })));
    return u;
  }

  async function secondAdmin() {
    return persistActor(db, adminActor());
  }

  it("admin→user üyeliksiz reddedilir ve hiçbir şey değişmez", async () => {
    const admin = await persistActor(db, adminActor());
    const other = await secondAdmin();
    await expect(updateUser(db, admin, { id: other.id, role: "user" })).rejects.toMatchObject({
      code: "invalid",
      message: "En az bir departman seçin",
    });
    const [r] = await db.select().from(users).where(eq(users.id, other.id));
    expect(r?.role).toBe("admin");
  });

  it("admin→user üyelik ve izinle tek çağrıda yazılır", async () => {
    const admin = await persistActor(db, adminActor());
    const other = await secondAdmin();
    await updateUser(db, admin, {
      id: other.id,
      role: "user",
      memberships: [{ department: "fnb", level: "member" }],
      permissions: [row("venues", "vc--")],
    });
    const [r] = await db.select().from(users).where(eq(users.id, other.id));
    expect(r?.role).toBe("user");
    expect(await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, other.id))).toHaveLength(1);
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, other.id))).toHaveLength(1);
  });

  it("eski rol→user: tavan dışı eski satırlar temizlenir, tavan içi kalır", async () => {
    const admin = await persistActor(db, adminActor());
    const target = await legacyUser("staff", [row("reservations", "v---"), row("venues", "v---")]);
    await updateUser(db, admin, {
      id: target.id,
      role: "user",
      memberships: [{ department: "fnb", level: "member" }],
    });
    const perms = await db.select().from(userPermissions).where(eq(userPermissions.userId, target.id));
    expect(perms.map((p) => p.module)).toEqual(["venues"]);
  });

  it("tavan dışı izinle güncelleme reddedilir; rol ve satırlar değişmez", async () => {
    const admin = await persistActor(db, adminActor());
    const target = await legacyUser("staff");
    await expect(
      updateUser(db, admin, {
        id: target.id,
        role: "user",
        name: "Yeni Ad",
        memberships: [{ department: "fnb", level: "member" }],
        permissions: [row("reservations", "v")],
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Bu izin seçilen departmanların kapsamı dışında" });
    const [r] = await db.select().from(users).where(eq(users.id, target.id));
    expect(r?.role).toBe("staff");
    expect(r?.name).not.toBe("Yeni Ad");
    expect(await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, target.id))).toHaveLength(0);
  });

  it("eski rol hedefte tüm bayrakları kapalı kısıt satırı korunur", async () => {
    const admin = await persistActor(db, adminActor());
    const target = await legacyUser("staff");
    await setUserPermissions(db, admin, { id: target.id, permissions: [row("reservations", "----")] });
    expect(await db.select().from(userPermissions).where(eq(userPermissions.userId, target.id))).toHaveLength(1);
  });

  it("oluşturma yarıda düşerse kullanıcı ve hesap satırı kalmaz", async () => {
    const admin = await persistActor(db, adminActor());
    // Şema dışı çağrı: yinelenen departman, üyelik yazımında tekillik ihlali verir (kullanıcı ve hesap yazıldıktan sonra).
    await expect(
      createUser(db, admin, {
        ...base,
        memberships: [
          { department: "fnb", level: "member" },
          { department: "fnb", level: "manager" },
        ],
        permissions: [],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
    expect(await db.select().from(accounts)).toHaveLength(0);
  });
});
