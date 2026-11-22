import { sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { encryptSecret, getSettingsKey } from "./crypto";
import type { UpdateSettingsInput } from "./schemas";

type SettingsRow = typeof systemSettings.$inferSelect;

/** İstemciye/yanıta çıkan ayarlar: şifreli parola yoktur, yalnızca var olup olmadığı bilinir. */
export type PublicSettings = Omit<SettingsRow, "smtpPasswordEncrypted"> & { smtpPasswordSet: boolean };

const SETTINGS_LOCK = sql`select pg_advisory_xact_lock(hashtext('system_settings'))`;

function toPublic(row: SettingsRow): PublicSettings {
  const { smtpPasswordEncrypted, ...rest } = row;
  return { ...rest, smtpPasswordSet: smtpPasswordEncrypted !== null };
}

/** Tek ayar satırını döner; yoksa varsayılanlarla oluşturur (eşzamanlı çağrılarda tek satır). */
async function ensureRow(tx: Tx): Promise<SettingsRow> {
  await tx.execute(SETTINGS_LOCK);
  const [existing] = await tx.select().from(systemSettings).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(systemSettings).values({}).returning();
  if (!created) throw new Error("Ayarlar oluşturulamadı");
  return created;
}

export async function getSettings(db: Db | Tx, actor: Actor): Promise<PublicSettings> {
  authorize(actor, "settings", "view");
  return toPublic(await db.transaction((tx) => ensureRow(tx)));
}

/**
 * Ayarları günceller. `key` yalnızca SMTP parolası değişirken okunur (test için enjekte edilebilir).
 */
export async function updateSettings(
  db: Db | Tx,
  actor: Actor,
  input: UpdateSettingsInput,
  key?: Buffer,
): Promise<PublicSettings> {
  authorize(actor, "settings", "edit");
  const { smtpPassword, ...rest } = input;

  const values: Partial<typeof systemSettings.$inferInsert> = { ...rest };
  if (smtpPassword !== undefined) {
    values.smtpPasswordEncrypted =
      smtpPassword === null || smtpPassword === "" ? null : encryptSecret(smtpPassword, key ?? getSettingsKey());
  }

  const row = await db.transaction(async (tx) => {
    const current = await ensureRow(tx);
    const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    if (Object.keys(defined).length === 0) return current;
    const [updated] = await tx
      .update(systemSettings)
      .set(defined)
      .where(sql`${systemSettings.id} = ${current.id}`)
      .returning();
    if (!updated) throw new Error("Ayarlar güncellenemedi");
    return updated;
  });
  return toPublic(row);
}
