import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { selfActionDefs } from "@/features/users/action-defs";
import {
  AVATAR_MAX_BYTES,
  centerSquare,
  checkAvatarDataUrl,
  displayableAvatar,
} from "@/features/users/avatar";
import { getOwnAvatar, setOwnAvatar } from "@/features/users/profile";
import { setOwnAvatarSchema } from "@/features/users/schemas";
import { createSelfAction } from "@/features/users/self-action";
import { truncateAll } from "../../helpers/db";
import { createUser as insertUser } from "../../helpers/factories";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function dataUrl(mime: string, signature: number[], size = 64): string {
  const bytes = new Uint8Array(Math.max(size, signature.length));
  bytes.set(signature);
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function actorOf(role: Actor["role"] = "staff", isActive = true): Promise<Actor> {
  const u = await insertUser(db, { role, isActive });
  return { id: u.id, username: u.username, role: u.role, staffId: null, memberships: [], permissions: [] };
}

describe("avatar biçim denetimi", () => {
  it("izinli türler, imzasıyla birlikte kabul edilir", () => {
    expect(checkAvatarDataUrl(dataUrl("image/jpeg", JPEG))).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(checkAvatarDataUrl(dataUrl("image/png", PNG))).toMatchObject({ ok: true, mime: "image/png" });
    expect(checkAvatarDataUrl(dataUrl("image/webp", WEBP))).toMatchObject({ ok: true, mime: "image/webp" });
  });

  it("izinsiz türler (SVG, GIF) ve data: olmayan değerler reddedilir", () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`;
    expect(checkAvatarDataUrl(svg)).toMatchObject({ ok: false, message: expect.stringContaining("JPEG") as string });
    expect(checkAvatarDataUrl(dataUrl("image/gif", [0x47, 0x49, 0x46, 0x38]))).toMatchObject({ ok: false });
    for (const value of [
      "https://example.com/a.png",
      "javascript:alert(1)",
      "/uploads/a.png",
      "data:text/html;base64,PGgxPg==",
      "",
    ]) {
      expect(checkAvatarDataUrl(value).ok).toBe(false);
    }
  });

  it("base64 olmayan, parametreli, bozuk ya da kanonik olmayan gövde reddedilir", () => {
    const good = dataUrl("image/png", PNG);
    const body = good.slice(good.indexOf(",") + 1);
    expect(checkAvatarDataUrl(`data:image/png,${body}`).ok).toBe(false);
    expect(checkAvatarDataUrl(`data:image/png;charset=utf-8;base64,${body}`).ok).toBe(false);
    expect(checkAvatarDataUrl(`data:image/png;base64,${body.slice(0, -1)}`).ok).toBe(false);
    expect(checkAvatarDataUrl(`data:image/png;base64,${body} `).ok).toBe(false);
    expect(checkAvatarDataUrl(`data:image/png;base64,${body}\n`).ok).toBe(false);
    expect(checkAvatarDataUrl("data:image/png;base64,").ok).toBe(false);
    expect(checkAvatarDataUrl("data:image/png;base64,QR==").ok).toBe(false);
    expect(checkAvatarDataUrl("data:IMAGE/PNG;base64,iVBORw0KGgo=").ok).toBe(false);
  });

  it("imza bildirilen türle uyuşmazsa reddedilir", () => {
    expect(checkAvatarDataUrl(dataUrl("image/png", JPEG))).toMatchObject({ ok: false, message: expect.stringContaining("uyuşmuyor") as string });
    expect(checkAvatarDataUrl(dataUrl("image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toMatchObject({
      ok: false,
    });
  });

  it("boyut sınırı: tam sınır geçer, bir bayt fazlası ve çok uzun metin reddedilir", () => {
    expect(checkAvatarDataUrl(dataUrl("image/jpeg", JPEG, AVATAR_MAX_BYTES)).ok).toBe(true);
    expect(checkAvatarDataUrl(dataUrl("image/jpeg", JPEG, AVATAR_MAX_BYTES + 1))).toMatchObject({
      ok: false,
      message: expect.stringContaining("KB") as string,
    });
    expect(checkAvatarDataUrl(`data:image/jpeg;base64,${"A".repeat(5_000_000)}`).ok).toBe(false);
  });

  it("görüntüleme yalnızca izinli data: URL'lerini geçirir", () => {
    expect(displayableAvatar(null)).toBeNull();
    expect(displayableAvatar("/uploads/eski.png")).toBeNull();
    expect(displayableAvatar("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    const ok = dataUrl("image/webp", WEBP);
    expect(displayableAvatar(ok)).toBe(ok);
  });

  it("ortadan kare kırpma", () => {
    expect(centerSquare(400, 200)).toEqual({ sx: 100, sy: 0, size: 200 });
    expect(centerSquare(200, 401)).toEqual({ sx: 0, sy: 100, size: 200 });
    expect(centerSquare(128, 128)).toEqual({ sx: 0, sy: 0, size: 128 });
  });

  it("şema: null kaldırmadır, bozuk değer alan hatası verir", () => {
    expect(setOwnAvatarSchema.safeParse({ image: null }).success).toBe(true);
    expect(setOwnAvatarSchema.safeParse({ image: "data:image/png;base64,AAAA" }).success).toBe(false);
    expect(setOwnAvatarSchema.safeParse({}).success).toBe(false);
  });
});

describe("kendi profil fotoğrafı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kendi satırına yazar ve kaldırır; başkasının satırına dokunmaz", async () => {
    const me = await actorOf("staff");
    const other = await actorOf("admin");
    const image = dataUrl("image/jpeg", JPEG, 2048);

    await expect(setOwnAvatar(db, me, { image })).resolves.toEqual({ hasAvatar: true });
    expect(await getOwnAvatar(db, me)).toBe(image);
    const [otherRow] = await db.select({ image: users.image }).from(users).where(eq(users.id, other.id));
    expect(otherRow?.image).toBeNull();

    await expect(setOwnAvatar(db, me, { image: null })).resolves.toEqual({ hasAvatar: false });
    expect(await getOwnAvatar(db, me)).toBeNull();
  });

  it("servis şemayı atlayan doğrudan çağrıda da bozuk değeri reddeder", async () => {
    const me = await actorOf();
    await expect(setOwnAvatar(db, me, { image: "data:image/svg+xml;base64,PHN2Zz4=" })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("pasif ya da olmayan hesap yazamaz", async () => {
    const inactive = await actorOf("staff", false);
    await expect(setOwnAvatar(db, inactive, { image: null })).rejects.toMatchObject({ code: "not_found" });
    const ghost: Actor = { id: "00000000-0000-4000-8000-0000000000bb", username: "x", role: "admin", staffId: null, memberships: [], permissions: [] };
    await expect(setOwnAvatar(db, ghost, { image: null })).rejects.toMatchObject({ code: "not_found" });
  });

  it("eski, gösterilemeyen değer null döner", async () => {
    const me = await actorOf();
    await db.update(users).set({ image: "https://example.com/a.png" }).where(eq(users.id, me.id));
    expect(await getOwnAvatar(db, me)).toBeNull();
  });

  it("action: her rol kendi fotoğrafını değiştirir; oturumsuz ve bozuk girdi reddedilir", async () => {
    for (const role of ["admin", "organizer", "staff", "leader", "controller", "venue_owner"] as const) {
      const actor = await actorOf(role);
      const run = createSelfAction({ getActor: async () => actor })(selfActionDefs.setOwnAvatar);
      expect(await run({ image: dataUrl("image/png", PNG) })).toEqual({ ok: true, data: { hasAvatar: true } });
    }
    const anon = createSelfAction({ getActor: async () => null })(selfActionDefs.setOwnAvatar);
    expect(await anon({ image: null })).toMatchObject({ ok: false, code: "unauthenticated" });

    const actor = await actorOf();
    const run = createSelfAction({ getActor: async () => actor })(selfActionDefs.setOwnAvatar);
    const bad = await run({ image: "data:image/gif;base64,R0lGODlh" });
    expect(bad).toMatchObject({ ok: false, code: "invalid" });
    expect(bad.ok ? null : bad.fieldErrors?.image?.[0]).toContain("JPEG");
    // Kimlik girdiden alınmaz: fazladan `id` alanı yok sayılır, yalnızca oturumdaki satır değişir.
    const victim = await actorOf("admin");
    await db.update(users).set({ image: dataUrl("image/png", PNG) }).where(eq(users.id, victim.id));
    expect(await run({ image: null, id: victim.id })).toMatchObject({ ok: true });
    expect(await getOwnAvatar(db, victim)).not.toBeNull();
  });
});
