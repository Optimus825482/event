/**
 * Kullanıcı adı kuralları. Eski sistemle uyum için büyük/küçük harf duyarlı ve
 * 1–100 karakter; baş/son boşluk ve her türlü kontrol/biçim karakteri (`\p{C}`)
 * reddedilir. Hem Better Auth eklentisi hem `scripts/create-admin.ts` kullanır.
 */
export const MIN_USERNAME_LENGTH = 1;
export const MAX_USERNAME_LENGTH = 100;

const CONTROL_OR_FORMAT = /\p{C}/u;

export function isValidUsername(value: string): boolean {
  if (value.length < MIN_USERNAME_LENGTH || value.length > MAX_USERNAME_LENGTH) return false;
  if (value.trim() !== value) return false;
  return !CONTROL_OR_FORMAT.test(value);
}
