export const GENERIC_LOGIN_ERROR = "Kullanıcı adı veya parola hatalı";

const MAX_WAIT_SECONDS = 24 * 60 * 60;

/** `Retry-After` / `X-Retry-After` (Better Auth) değerini saniye olarak çözer; geçersizse null. */
export function parseRetryAfter(raw: string | null): number | null {
  const text = raw?.trim() ?? "";
  if (!/^\d+$/.test(text)) return null;
  const seconds = Number(text);
  return seconds >= 1 && seconds <= MAX_WAIT_SECONDS ? seconds : null;
}

function waitPhrase(seconds: number): string {
  return seconds < 60 ? `${seconds} saniye` : `${Math.ceil(seconds / 60)} dakika`;
}

/** Giriş isteğinin başarısız yanıtı için kullanıcıya gösterilecek Türkçe mesaj. */
export function loginErrorMessage(status: number, retryAfter: string | null): string {
  if (status !== 429) return GENERIC_LOGIN_ERROR;
  const seconds = parseRetryAfter(retryAfter);
  return seconds === null
    ? "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin."
    : `Çok fazla deneme yapıldı. Lütfen ${waitPhrase(seconds)} sonra tekrar deneyin.`;
}
