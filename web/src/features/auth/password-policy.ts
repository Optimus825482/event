/**
 * Parola kuralı: tek kaynak. İstemci ve sunucu aynı işlevi kullanır;
 * `scripts/create-admin.mjs` bağımsız çalıştığı için kuralın kopyasını taşır (testle eşitliği doğrulanır).
 */
export const MIN_PASSWORD_LENGTH = 6;

export const PASSWORD_RULE_HINT = `En az ${MIN_PASSWORD_LENGTH} karakter; büyük harf, küçük harf ve rakam içermeli`;

const TOO_SHORT = `Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`;
const MISSING_CLASS = "Parola büyük harf, küçük harf ve rakam içermeli";

/** Kurala uymayan parola için Türkçe hata; uygunsa `null`. Harf sınıfları Unicode'dur (İ, ş, ğ sayılır). */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return TOO_SHORT;
  if (!/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/\d/.test(password)) return MISSING_CLASS;
  return null;
}
