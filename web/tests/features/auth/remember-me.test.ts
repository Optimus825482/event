import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { createUser } from "@/features/users/service";
import { truncateAll } from "../../helpers/db";
import { createUser as insertUser } from "../../helpers/factories";
import { call, hasSessionCookie, PASSWORD, sessionCookie, sessionSetCookie } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedUser(username: string): Promise<string> {
  const admin = await insertUser(db, { role: "admin" });
  const user = await createUser(db, { id: admin.id, username: admin.username, role: "admin", staffId: null, memberships: [], permissions: [] }, {
    username,
    password: PASSWORD,
    role: "staff",
  });
  return user.id;
}

function signInWith(username: string, rememberMe?: boolean) {
  const body = rememberMe === undefined ? { username, password: PASSWORD } : { username, password: PASSWORD, rememberMe };
  return call("/sign-in/username", { body });
}

async function sessionExpiry(userId: string): Promise<number> {
  const [row] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));
  if (!row) throw new Error("oturum yok");
  return row.expiresAt.getTime() - Date.now();
}

describe("Beni hatırla (rememberMe)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("işaretli: kalıcı çerez (Max-Age) ve 7 günlük oturum", async () => {
    const id = await seedUser("hatirla");
    const res = await signInWith("hatirla", true);
    expect(res.status).toBe(200);
    expect(sessionSetCookie(res)).toMatch(/Max-Age=\d+/i);
    expect(await sessionExpiry(id)).toBeGreaterThan(6 * DAY_MS);
  });

  it("işaretsiz: Max-Age/Expires'sız oturum çerezi ve kısa oturum", async () => {
    const id = await seedUser("unut");
    const res = await signInWith("unut", false);
    expect(res.status).toBe(200);
    const cookie = sessionSetCookie(res);
    expect(cookie).not.toMatch(/Max-Age=/i);
    expect(cookie).not.toMatch(/Expires=/i);
    expect(await sessionExpiry(id)).toBeLessThanOrEqual(DAY_MS + 60_000);

    // Oturum çalışır.
    const session = await call("/get-session", { method: "GET", cookie: sessionCookie(res) });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { id } });
  });

  it("alan verilmezse varsayılan davranış hatırlamaktır; yanlış türde değer reddedilir", async () => {
    await seedUser("varsayilan");
    expect(sessionSetCookie(await signInWith("varsayilan"))).toMatch(/Max-Age=\d+/i);
    const bad = await call("/sign-in/username", { body: { username: "varsayilan", password: PASSWORD, rememberMe: "hayir" } });
    expect(bad.status).toBe(400);
    expect(hasSessionCookie(bad)).toBe(false);
  });
});
