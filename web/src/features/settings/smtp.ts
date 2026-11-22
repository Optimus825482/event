// Yalnızca sunucuda kullanılır: çözülmüş SMTP parolası içerir. İstemciye döndürülmez, günlüğe yazılmaz.
import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { DomainError } from "@/lib/action";
import { decryptSecret, getSettingsKey } from "./crypto";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

function formatFrom(name: string | null, email: string): string {
  const cleanName = (name ?? "").replace(/["\\\r\n<>]/g, "").trim();
  return cleanName ? `"${cleanName}" <${email}>` : email;
}

/**
 * SMTP ayarlarını okur ve parolayı çözer. Sunucu ya da gönderen adresi yoksa (yapılandırılmamış)
 * `null` döner. Parola kayıtlı ama çözülemiyorsa (anahtar eksik/yanlış) anlaşılır `DomainError`.
 * `key` yalnızca testler içindir.
 */
export async function getSmtpConfig(db: Db | Tx, key?: Buffer): Promise<SmtpConfig | null> {
  const [row] = await db.select().from(systemSettings).limit(1);
  const host = row?.smtpHost?.trim();
  const fromEmail = row?.smtpFromEmail?.trim();
  if (!row || !host || !fromEmail) return null;

  let password = "";
  if (row.smtpPasswordEncrypted) {
    try {
      password = decryptSecret(row.smtpPasswordEncrypted, key ?? getSettingsKey());
    } catch {
      throw new DomainError(
        "conflict",
        "SMTP parolası çözülemedi: SETTINGS_ENCRYPTION_KEY eksik ya da değişmiş. Parolayı Ayarlar bölümünden yeniden kaydedin.",
      );
    }
  }

  return {
    host,
    port: row.smtpPort,
    secure: row.smtpSecure,
    user: row.smtpUser?.trim() ?? "",
    password,
    from: formatFrom(row.smtpFromName, fromEmail),
  };
}
