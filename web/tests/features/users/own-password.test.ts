import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { loginAttempts, sessions, users } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { selfActionDefs } from "@/features/users/action-defs";
import { isValidUsername } from "@/features/auth/username";
import { changeOwnPassword, limiterKey } from "@/features/users/own-password";
import { createSelfAction } from "@/features/users/self-action";
import { createUser } from "@/features/users/service";
import { truncateAll } from "../../helpers/db";
import { createUser as insertUser } from "../../helpers/factories";
import { PASSWORD, sessionCookie, signIn } from "../auth/helpers";

const NEW_PASSWORD = "YepYeniParola!2025";
const WRONG = "YanlisParola!2024";
const TOO_MANY = { message: expect.stringContaining("Çok fazla") as string };

async function makeUser(username: string, active = true): Promise<Actor> {
  const admin = await insertUser(db, { role: "admin" });
  const adminActor: Actor = { id: admin.id, username: admin.username, role: "admin", staffId: null, memberships: [], permissions: [] };
  const created = await createUser(db, adminActor, { username, password: PASSWORD, role: "staff" });
  if (!active) await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));
  return { id: created.id, username, role: "staff", staffId: null, memberships: [], permissions: [] };
}

/** Gerçek bir giriş yapar ve oluşan oturum satırının kimliğini döner. */
async function signInSession(actor: Actor): Promise<string> {
  const res = await signIn(actor.username, PASSWORD);
  expect(res.status).toBe(200);
  const token = decodeURIComponent(sessionCookie(res).split("=")[1] ?? "").split(".")[0] ?? "";
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.token, token));
  if (!row) throw new Error("Oturum satırı bulunamadı");
  return row.id;
}

describe("kendi parolasını değiştirme", () => {
  it("deneme sayacı anahtarı geçerli bir kullanıcı adı olamaz (giriş ucu aynı sayacı dolduramaz)", () => {
    expect(isValidUsername(limiterKey("00000000-0000-4000-8000-000000000000"))).toBe(false);
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("başarı: eski parola geçmez, yenisi girer; mevcut oturum kalır, diğerleri kapanır", async () => {
    const me = await makeUser("ayse");
    const current = await signInSession(me);
    const other = await signInSession(me);

    await changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, current);

    const left = (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, me.id))).map((r) => r.id);
    expect(left).toContain(current);
    expect(left).not.toContain(other);
    expect((await signIn("ayse", PASSWORD)).status).not.toBe(200);
    expect((await signIn("ayse", NEW_PASSWORD)).status).toBe(200);
  });

  it("geçerli oturum bilinmiyorsa tüm oturumlar kapanır", async () => {
    const me = await makeUser("ayse");
    await signInSession(me);
    await changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(await db.select().from(sessions).where(eq(sessions.userId, me.id))).toHaveLength(0);
  });

  it("yanlış mevcut parola: ayrıntısız hata, hiçbir şey değişmez", async () => {
    const me = await makeUser("ayse");
    const session = await signInSession(me);
    await expect(
      changeOwnPassword(db, me, { currentPassword: WRONG, newPassword: NEW_PASSWORD }, session),
    ).rejects.toMatchObject({ code: "invalid", message: "Mevcut parola hatalı" });
    expect((await signIn("ayse", PASSWORD)).status).toBe(200);
    expect((await signIn("ayse", NEW_PASSWORD)).status).not.toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.id, session))).toHaveLength(1);
  });

  it("zayıf ve aynı yeni parola reddedilir (şema ve servis)", async () => {
    const me = await makeUser("ayse");
    const run = createSelfAction({ getActor: async () => me })(selfActionDefs.changeOwnPassword);
    expect(await run({ currentPassword: PASSWORD, newPassword: "kisa" })).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { newPassword: [expect.stringContaining("en az 12") as string] },
    });
    expect(await run({ currentPassword: PASSWORD, newPassword: PASSWORD })).toMatchObject({ ok: false, code: "invalid" });
    await expect(changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: PASSWORD })).rejects.toMatchObject({
      code: "invalid",
    });
    expect((await signIn("ayse", PASSWORD)).status).toBe(200);
  });

  it("başka kullanıcının parolasını ve oturumlarını etkilemez", async () => {
    const me = await makeUser("ayse");
    const other = await makeUser("mehmet");
    const otherSession = await signInSession(other);
    await changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect((await signIn("mehmet", PASSWORD)).status).toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.id, otherSession))).toHaveLength(1);
  });

  it("pasif kullanıcı reddedilir; parolası değişmez", async () => {
    const me = await makeUser("ayse", false);
    await expect(
      changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
    ).rejects.toMatchObject({ code: "not_found" });
    await db.update(users).set({ isActive: true }).where(eq(users.id, me.id));
    expect((await signIn("ayse", PASSWORD)).status).toBe(200);
  });

  it("oturumsuz eylem unauthenticated döner", async () => {
    const run = createSelfAction({ getActor: async () => null })(selfActionDefs.changeOwnPassword);
    expect(await run({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).toMatchObject({
      ok: false,
      code: "unauthenticated",
    });
  });

  it("yanlış denemeler sınırlanır (kilitliyken doğru parola da geçmez); başarı sayacı siler", async () => {
    const me = await makeUser("ayse");
    const bad = { currentPassword: WRONG, newPassword: NEW_PASSWORD };
    for (let i = 0; i < 5; i += 1) {
      await expect(changeOwnPassword(db, me, bad)).rejects.toMatchObject({ message: "Mevcut parola hatalı" });
    }
    await expect(changeOwnPassword(db, me, bad)).rejects.toMatchObject(TOO_MANY);
    await expect(
      changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
    ).rejects.toMatchObject(TOO_MANY);
    expect((await signIn("ayse", NEW_PASSWORD)).status).not.toBe(200);

    await db.delete(loginAttempts);
    await changeOwnPassword(db, me, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    const rows = await db.select().from(loginAttempts);
    expect(rows.every((r) => r.ip === "*")).toBe(true); // yalnızca genel sayaç kalır
  });
});
