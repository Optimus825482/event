import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { decryptSecret } from "@/features/settings/crypto";
import { updateSettingsSchema } from "@/features/settings/schemas";
import { getSettings, updateSettings } from "@/features/settings/service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";

const key = randomBytes(32);
const PLAIN = "SmtpParolasi-Cok-Gizli-123";

async function actorOf(actor: Actor): Promise<Actor> {
  return persistActor(db, actor);
}

describe("sistem ayarları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ilk okumada varsayılan satırı oluşturur; eşzamanlı okumalar tek satır bırakır", async () => {
    const admin = await actorOf(adminActor());
    const results = await Promise.all(Array.from({ length: 8 }, () => getSettings(db, admin)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await db.select().from(systemSettings)).toHaveLength(1);
    expect(results[0]?.companyName).toBe("EventFlow");
    expect(results[0]?.smtpPasswordSet).toBe(false);
  });

  it("SMTP parolası getSettings çıktısında yok; yalnızca smtpPasswordSet var", async () => {
    const admin = await actorOf(adminActor());
    await updateSettings(db, admin, { smtpHost: "smtp.example.com", smtpPassword: PLAIN }, key);

    const out = await getSettings(db, admin);
    const json = JSON.stringify(out);
    expect(json).not.toContain(PLAIN);
    expect(json).not.toContain("smtpPasswordEncrypted");
    expect(json).not.toContain("v1:");
    expect(out.smtpPasswordSet).toBe(true);
    expect(out.smtpHost).toBe("smtp.example.com");
  });

  it("updateSettings yanıtında da parola yok; veritabanında şifreli saklanır", async () => {
    const admin = await actorOf(adminActor());
    const out = await updateSettings(db, admin, { smtpPassword: PLAIN }, key);
    expect(JSON.stringify(out)).not.toContain(PLAIN);

    const [row] = await db.select().from(systemSettings);
    expect(row?.smtpPasswordEncrypted).toBeTruthy();
    expect(row?.smtpPasswordEncrypted).not.toContain(PLAIN);
    expect(decryptSecret(row?.smtpPasswordEncrypted ?? "", key)).toBe(PLAIN);
  });

  it("parola alanı verilmezse mevcut parola korunur; null ile silinir", async () => {
    const admin = await actorOf(adminActor());
    await updateSettings(db, admin, { smtpPassword: PLAIN }, key);
    await updateSettings(db, admin, { companyName: "Yeni Ad" }, key);
    const [kept] = await db.select().from(systemSettings);
    expect(decryptSecret(kept?.smtpPasswordEncrypted ?? "", key)).toBe(PLAIN);

    const cleared = await updateSettings(db, admin, { smtpPassword: null }, key);
    expect(cleared.smtpPasswordSet).toBe(false);
    const [row] = await db.select().from(systemSettings);
    expect(row?.smtpPasswordEncrypted).toBeNull();
    expect(row?.companyName).toBe("Yeni Ad");
  });

  it("anahtar yapılandırılmamışsa parola kaydetmeyi açık hatayla reddeder, düz metin yazmaz", async () => {
    const admin = await actorOf(adminActor());
    const original = process.env.SETTINGS_ENCRYPTION_KEY;
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    try {
      await expect(updateSettings(db, admin, { smtpPassword: PLAIN })).rejects.toThrow(/SETTINGS_ENCRYPTION_KEY/);
    } finally {
      if (original !== undefined) process.env.SETTINGS_ENCRYPTION_KEY = original;
    }
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.smtpPasswordEncrypted, PLAIN));
    expect(rows).toHaveLength(0);
  });

  it("admin olmayan kullanıcı okuyamaz ve güncelleyemez", async () => {
    const organizer = await actorOf(managerActor("entertainment"));
    await expect(getSettings(db, organizer)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateSettings(db, organizer, { companyName: "X" }, key)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("şema: sınırlar ve boş metin → null", () => {
    expect(updateSettingsSchema.safeParse({ smtpPort: 0 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ smtpPort: 70000 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ defaultGridSize: 101 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ smtpFromEmail: "gecersiz" }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ companyName: "   " }).success).toBe(false);
    expect(updateSettingsSchema.parse({ smtpHost: "  " }).smtpHost).toBeNull();
  });

  it("şema: logo ve şifreli alan istemciden kabul edilmez", () => {
    const parsed = updateSettingsSchema.parse({ companyName: "A", logo: "../x", smtpPasswordEncrypted: "v1:x" });
    expect(parsed).not.toHaveProperty("logo");
    expect(parsed).not.toHaveProperty("smtpPasswordEncrypted");
  });
});
