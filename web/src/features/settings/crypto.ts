import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ENV = "SETTINGS_ENCRYPTION_KEY";

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) throw new Error(`Şifreleme anahtarı ${KEY_BYTES} bayt olmalı`);
}

/**
 * AES-256-GCM ile şifreler. Çıktı biçimi: `v1:<iv>:<etiket>:<şifreli metin>` (base64).
 * Her çağrıda yeni rastgele 12 baytlık IV kullanılır.
 */
export function encryptSecret(plain: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

/** `encryptSecret` çıktısını çözer; yanlış anahtar, bozulmuş veri ya da bilinmeyen sürümde hata verir. */
export function decryptSecret(cipherText: string, key: Buffer): string {
  assertKey(key);
  const parts = cipherText.split(":");
  const [version, ivB64, tagB64, dataB64] = parts;
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Şifreli değer biçimi tanınmıyor");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Şifreli değer biçimi tanınmıyor");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** `SETTINGS_ENCRYPTION_KEY` (32 bayt, base64) okur; eksik ya da geçersizse açık bir hata fırlatır. */
export function getSettingsKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) throw new Error(`${KEY_ENV} ortam değişkeni tanımlı değil (32 baytlık base64 anahtar gerekli)`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${KEY_ENV} geçersiz: base64 çözüldüğünde ${KEY_BYTES} bayt olmalı`);
  }
  return key;
}
