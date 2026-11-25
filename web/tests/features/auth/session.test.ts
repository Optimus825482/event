import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, departmentMemberships, userPermissions, users } from "@/db/schema";
import { createAuth } from "@/features/auth/auth";
import { getActorFromHeaders } from "@/features/auth/session";
import { createAdmin } from "../../../scripts/create-admin-dev";
import { truncateAll } from "../../helpers/db";
import { createMembership } from "../../helpers/factories";
import {
  call,
  hasSessionCookie,
  PASSWORD,
  sessionCookie,
  sessionSetCookie,
  signIn,
  WRONG_PASSWORD,
} from "./helpers";

describe("kimlik doğrulama", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("betikle oluşturulan kullanıcı giriş yapar; çerez HttpOnly ve SameSite=Lax", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const res = await signIn("yonetici", PASSWORD);

    expect(res.status).toBe(200);
    const cookie = sessionSetCookie(res);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
  });

  it("üretim ayarlarıyla kurulan örnekte oturum çerezi Secure taşır", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });
    const baseURL = "https://eventflow.example.com";
    const production = createAuth({ production: true, baseURL, trustedIpHeader: "x-forwarded-for" });

    const res = await call("/sign-in/username", {
      instance: production,
      baseURL,
      body: { username: "yonetici", password: PASSWORD },
    });

    expect(res.status).toBe(200);
    const cookie = sessionSetCookie(res);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
  });

  it("e-posta verilmeden oluşturulan yönetici yer tutucu e-posta ve admin rolü alır", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const [row] = await db.select().from(users).where(eq(users.username, "yonetici"));

    expect(row?.email).toBe("yonetici@eventflow.invalid");
    expect(row?.role).toBe("admin");
    expect(row?.isActive).toBe(true);
  });

  it("yanlış parola reddedilir ve yanıt kullanıcı adının var olup olmadığını ele vermez", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const wrongPassword = await signIn("yonetici", WRONG_PASSWORD);
    const unknownUser = await signIn("olmayan_kullanici", WRONG_PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(await unknownUser.json()).toEqual(await wrongPassword.json());
    expect(hasSessionCookie(wrongPassword)).toBe(false);
  });

  it("herkese açık kayıt ucu 404 döner ve kullanıcı oluşturmaz", async () => {
    const res = await call("/sign-up/email", {
      body: {
        name: "Saldırgan",
        email: "saldirgan@example.com",
        password: "SaldirganParola!2024",
        username: "saldirgan",
      },
    });

    expect(res.status).toBe(404);
    const rows = await db.select({ id: users.id }).from(users);
    expect(rows).toHaveLength(0);
  });

  it("eski sistemden gelen bcrypt hash'i ile giriş başarılıdır", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Eski Kullanıcı", email: "eski@eventflow.invalid", username: "eski_kullanici" })
      .returning({ id: users.id });
    if (!user) throw new Error("Kullanıcı eklenemedi");
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: bcrypt.hashSync("EskiParola!2024", 12),
    });

    const res = await signIn("eski_kullanici", "EskiParola!2024");

    expect(res.status).toBe(200);
    expect(sessionSetCookie(res)).toMatch(/;\s*HttpOnly/i);
  });

  it("is_active=false yapılan kullanıcının geçerli oturum çereziyle getActor null döner", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const headers = new Headers({ cookie: sessionCookie(await signIn("yonetici", PASSWORD)) });

    expect(await getActorFromHeaders(headers)).toEqual({
      id: created.id,
      username: "yonetici",
      role: "admin",
      staffId: null,
      memberships: [],
      permissions: [],
    });

    await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));

    expect(await getActorFromHeaders(headers)).toBeNull();
  });

  it("getActor departman üyeliklerini ve izin satırlarını taşır; üyelik değişikliği sonraki çağrıda görünür", async () => {
    const created = await createAdmin({ username: "fnb_kullanici", password: PASSWORD });
    await db.update(users).set({ role: "user" }).where(eq(users.id, created.id));
    await createMembership(db, { userId: created.id, department: "fnb", level: "manager" });
    await db.insert(userPermissions).values({
      userId: created.id,
      module: "venues",
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
    });
    const headers = new Headers({ cookie: sessionCookie(await signIn("fnb_kullanici", PASSWORD)) });

    expect(await getActorFromHeaders(headers)).toEqual({
      id: created.id,
      username: "fnb_kullanici",
      role: "user",
      staffId: null,
      memberships: [{ department: "fnb", level: "manager" }],
      permissions: [{ module: "venues", canView: true, canCreate: true, canEdit: false, canDelete: false }],
    });

    await db
      .update(departmentMemberships)
      .set({ level: "member" })
      .where(eq(departmentMemberships.userId, created.id));

    expect((await getActorFromHeaders(headers))?.memberships).toEqual([{ department: "fnb", level: "member" }]);
  });

  it("oturum çerezi olmadan getActor null döner", async () => {
    expect(await getActorFromHeaders(new Headers())).toBeNull();
  });

  it("pasif kullanıcı doğru parolayla da giriş yapamaz ve aynı genel hatayı alır", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));
    const wrongPassword = await signIn("yonetici", WRONG_PASSWORD);

    const res = await signIn("yonetici", PASSWORD);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(await wrongPassword.json());
  });

  it("phone ve position alanları veritabanında saklanır", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    await db
      .update(users)
      .set({ phone: "05551234567", position: "Salon sorumlusu" })
      .where(eq(users.id, created.id));

    const [row] = await db
      .select({ phone: users.phone, position: users.position })
      .from(users)
      .where(eq(users.id, created.id));

    expect(row).toEqual({ phone: "05551234567", position: "Salon sorumlusu" });
  });
});
