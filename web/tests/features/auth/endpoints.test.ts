import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createAdmin } from "../../../scripts/create-admin-dev";
import { truncateAll } from "../../helpers/db";
import { call, PASSWORD, signedInCookie } from "./helpers";

/** İstemcilere kapalı olması gereken uçlar (izin listesi dışında kalan her şey). */
const BLOCKED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/update-user",
  "/change-email",
  "/change-password",
  "/set-password",
  "/delete-user",
  "/delete-user/callback",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/abc",
  "/send-verification-email",
  "/verify-email",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/update-session",
  "/list-accounts",
  "/unlink-account",
  "/link-social",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
  "/sign-in/social",
  "/callback/google",
  "/is-username-available",
  "/error",
  "/gelecekte-eklenecek-uc",
] as const;

describe("Better Auth uç izin listesi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("is-username-available var olan ve olmayan kullanıcı adı için aynı 404 yanıtını verir", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const existing = await call("/is-username-available", { body: { username: "yonetici" } });
    const missing = await call("/is-username-available", { body: { username: "olmayan" } });

    expect(existing.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await existing.text()).toBe(await missing.text());
  });

  it("izin listesi dışındaki her uç oturum çerezi olmadan 404 döner", async () => {
    for (const path of BLOCKED_PATHS) {
      for (const method of ["GET", "POST"] as const) {
        const res = await call(path, { method, body: {} });
        expect({ path, method, status: res.status }).toEqual({ path, method, status: 404 });
      }
    }
  });

  it("izin listesi dışındaki her uç geçerli oturum çereziyle de 404 döner", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");

    for (const path of BLOCKED_PATHS) {
      for (const method of ["GET", "POST"] as const) {
        const res = await call(path, { method, body: {}, cookie });
        expect({ path, method, status: res.status }).toEqual({ path, method, status: 404 });
      }
    }
  });

  it("izinli uçlar yanlış HTTP yöntemiyle 404 döner", async () => {
    expect((await call("/sign-in/username", { method: "GET" })).status).toBe(404);
    expect((await call("/sign-out", { method: "GET" })).status).toBe(404);
    expect((await call("/get-session", { method: "POST" })).status).toBe(404);
  });

  it("izinli uçlar çalışır: ok, get-session, sign-out", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");

    expect((await call("/ok", { method: "GET" })).status).toBe(200);

    const session = await call("/get-session", { method: "GET", cookie });
    expect(session.status).toBe(200);
    expect(((await session.json()) as { user: { username: string } }).user.username).toBe("yonetici");

    expect((await call("/sign-out", { cookie })).status).toBe(200);
    const after = await call("/get-session", { method: "GET", cookie });
    expect(await after.json()).toBeNull();
  });

  it("oturum açmış kullanıcı korumalı alanlarını hiçbir uçtan değiştiremez", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");
    const [before] = await db.select().from(users).where(eq(users.id, created.id));

    const attempts: Array<[string, Record<string, unknown>]> = [
      [
        "/update-user",
        {
          name: "Yeni Ad",
          username: "baska",
          email: "baska@example.com",
          role: "user",
          isActive: false,
          staffId: "00000000-0000-4000-8000-000000000000",
          phone: "05550000000",
          position: "Müdür",
          image: "https://example.com/a.png",
        },
      ],
      ["/change-email", { newEmail: "baska@example.com" }],
      ["/change-password", { currentPassword: PASSWORD, newPassword: "YeniParola!2024x" }],
    ];
    for (const [path, body] of attempts) {
      expect((await call(path, { body, cookie })).status).toBe(404);
    }

    const [after] = await db.select().from(users).where(eq(users.id, created.id));
    expect(after).toEqual(before);
  });
});
