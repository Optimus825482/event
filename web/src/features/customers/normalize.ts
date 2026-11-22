const TR_NATIONAL = /^[2-58]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Türkiye telefon numarasını `+90XXXXXXXXXX` biçimine çevirir; tanınmazsa `null`.
 * `0532 111 22 33`, `+90 532 111 22 33`, `00905321112233` ve `5321112233` aynı sonucu verir.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return TR_NATIONAL.test(digits) ? `+90${digits}` : null;
}

/** E-postayı kırpıp küçük harfe çevirir; geçerli görünmüyorsa `null`. */
export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EMAIL.test(value) ? value : null;
}
