import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { deactivateUser, reactivateUser } from "@/features/auth/admin";
import { getActorFromHeaders } from "@/features/auth/session";
import { createAdmin } from "../../../scripts/create-admin";
import { truncateAll } from "../../helpers/db";
import { call, PASSWORD, signedInCookie, signIn, WRONG_PASSWORD } from "./helpers";

async function sessionCount(userId: string): Promise<number> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  return rows.length;
}

describe("kullanıcıyı pasife alma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("deactivateUser kullanıcının tüm oturumlarını siler ve eski çerezi geçersiz kılar", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");
    await signedInCookie("yonetici");
    expect(await sessionCount(created.id)).toBe(2);

    await deactivateUser(created.id);

    expect(await sessionCount(created.id)).toBe(0);
    const [row] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, created.id));
    expect(row?.isActive).toBe(false);
    const session = await call("/get-session", { method: "GET", cookie });
    expect(await session.json()).toBeNull();
    expect(await getActorFromHeaders(new Headers({ cookie }))).toBeNull();
  });

  it("pasife alınan kullanıcının girişi yanlış parolayla aynı yanıtla reddedilir", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const wrongPassword = await signIn("yonetici", WRONG_PASSWORD);
    const wrongBody: unknown = await wrongPassword.json();

    await deactivateUser(created.id);
    const res = await signIn("yonetici", PASSWORD);

    expect(res.status).toBe(wrongPassword.status);
    expect(await res.json()).toEqual(wrongBody);
  });

  it("reactivateUser sonrası kullanıcı yeniden giriş yapabilir", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    await deactivateUser(created.id);

    await reactivateUser(created.id);

    expect((await signIn("yonetici", PASSWORD)).status).toBe(200);
  });

  it("is_active doğrudan veritabanında kapatılırsa get-session eski çerezle oturum döndürmez", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");

    await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));
    const res = await call("/get-session", { method: "GET", cookie });

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(await sessionCount(created.id)).toBe(0);
  });
});
