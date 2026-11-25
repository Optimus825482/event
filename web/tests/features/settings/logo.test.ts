import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { replaceLogo } from "@/features/settings/logo";
import { getSettings } from "@/features/settings/service";
import { ImageRejectedError } from "@/features/uploads/images";
import { truncateAll } from "../../helpers/db";
import { createUser } from "../../helpers/factories";

sharp.cache(false);
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "eventflow-logo-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function actorOf(role: Actor["role"]): Promise<Actor> {
  const u = await createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: null, memberships: [], permissions: [] };
}

async function pngFile(): Promise<File> {
  const data = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#123456" } })
    .png()
    .toBuffer();
  return new File([data], "logo.png", { type: "image/png" });
}

describe("replaceLogo", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("logoyu kaydeder, ayara yazar ve önceki dosyayı siler", async () => {
    const admin = await actorOf("admin");
    const first = await replaceLogo(db, admin, await pngFile(), root);
    expect(first.logo).toMatch(/^logo\/.+\.webp$/);
    expect(existsSync(path.join(root, first.logo ?? ""))).toBe(true);

    const second = await replaceLogo(db, admin, await pngFile(), root);
    expect(second.logo).not.toBe(first.logo);
    expect(existsSync(path.join(root, first.logo ?? ""))).toBe(false);
    expect((await getSettings(db, admin)).logo).toBe(second.logo);
  });

  it("geçersiz dosyayı reddeder ve mevcut logoyu korur", async () => {
    const admin = await actorOf("admin");
    const saved = await replaceLogo(db, admin, await pngFile(), root);
    const html = new File(["<html></html>"], "logo.png", { type: "image/png" });
    await expect(replaceLogo(db, admin, html, root)).rejects.toBeInstanceOf(ImageRejectedError);
    expect((await getSettings(db, admin)).logo).toBe(saved.logo);
  });

  it("admin olmayan kullanıcı logo değiştiremez", async () => {
    const organizer = await actorOf("organizer");
    await expect(replaceLogo(db, organizer, await pngFile(), root)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
