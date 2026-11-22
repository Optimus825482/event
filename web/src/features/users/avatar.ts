/**
 * Profil fotoğrafı: istemci görseli küçük bir kareye indirger ve `data:` URL olarak gönderir; sonuç
 * Better Auth `users.image` sütununda saklanır (ayrı dosya deposu yok). Sunucu biçimi sıkı denetler.
 * Hem tarayıcıda hem sunucuda çalışır (yalnızca `atob`; Node `Buffer` kullanılmaz).
 */

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/** İstemcinin ürettiği kare görselin kenarı (piksel). */
export const AVATAR_SIZE = 128;
/** Çözülmüş görsel için üst sınır (bayt). */
export const AVATAR_MAX_BYTES = 60 * 1024;
/** Kullanıcının seçebileceği kaynak dosya için üst sınır (yeniden boyutlandırmadan önce). */
export const AVATAR_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

const PREFIX = /^data:(image\/(?:jpeg|png|webp));base64,/;
const OTHER_IMAGE_PREFIX = /^data:image\/[a-z0-9.+-]+;base64,/;
const BASE64_BODY =/^[A-Za-z0-9+/]*={0,2}$/;
/** Base64 gövdesinin en uzun hâli + en uzun önek; daha uzun girdi düzenli ifadeye hiç girmez. */
const MAX_DATA_URL_LENGTH = Math.ceil(AVATAR_MAX_BYTES / 3) * 4 + "data:image/webp;base64,".length;

export type AvatarCheck = { ok: true; mime: AvatarMimeType; bytes: number } | { ok: false; message: string };

const MESSAGES = {
  format: "Görsel data:image/...;base64 biçiminde olmalı",
  mime: "Yalnızca JPEG, PNG veya WebP görsel yüklenebilir",
  size: `Görsel en fazla ${AVATAR_MAX_BYTES / 1024} KB olabilir`,
  content: "Görsel içeriği bildirilen türle uyuşmuyor",
} as const;

function startsWith(bytes: string, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes.charCodeAt(offset + i) === byte);
}

/** Dosya imzası (sihirli baytlar) bildirilen MIME türüyle eşleşmeli. */
function matchesSignature(mime: AvatarMimeType, bytes: string): boolean {
  if (mime === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // RIFF....WEBP
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
}

function isAvatarMime(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * `data:image/(jpeg|png|webp);base64,<gövde>` biçimini, kanonik base64'ü, çözülmüş boyutu ve dosya
 * imzasını denetler. Parametreli (`;charset=`), base64 olmayan, SVG/GIF veya bozuk girdiler reddedilir.
 */
export function checkAvatarDataUrl(value: string): AvatarCheck {
  if (value.length > MAX_DATA_URL_LENGTH) return { ok: false, message: MESSAGES.size };
  if (!value.startsWith("data:image/")) return { ok: false, message: MESSAGES.format };
  const prefix = PREFIX.exec(value);
  if (!prefix) {
    // Biçimce düzgün ama izinsiz tür (svg+xml, gif…) ayrı iletiyle reddedilir.
    return OTHER_IMAGE_PREFIX.test(value) ? { ok: false, message: MESSAGES.mime } : { ok: false, message: MESSAGES.format };
  }
  const mime = prefix[1] ?? "";
  if (!isAvatarMime(mime)) return { ok: false, message: MESSAGES.mime };

  const body = value.slice(prefix[0].length);
  if (body.length === 0 || body.length % 4 !== 0 || !BASE64_BODY.test(body)) {
    return { ok: false, message: MESSAGES.format };
  }
  let decoded: string;
  try {
    decoded = atob(body);
  } catch {
    return { ok: false, message: MESSAGES.format };
  }
  // Kanonik olmayan dolgu bitleri (ör. "QR==" yerine "QQ==") aynı baytlara çözülür; yeniden kodlayıp eşitlik aranır.
  if (btoa(decoded) !== body) return { ok: false, message: MESSAGES.format };
  if (decoded.length > AVATAR_MAX_BYTES) return { ok: false, message: MESSAGES.size };
  if (!matchesSignature(mime, decoded)) return { ok: false, message: MESSAGES.content };
  return { ok: true, mime, bytes: decoded.length };
}

/** Görüntülemede savunma: yalnızca izinli türde `data:` URL'leri `<img src>` olur (eski/yabancı değerler gösterilmez). */
export function displayableAvatar(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^data:image\/(?:jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH ? value : null;
}

/** Ortadan kare kırpma: kaynağın kısa kenarı kadar, ortalanmış bölge. */
export function centerSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.max(0, Math.min(width, height));
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}
