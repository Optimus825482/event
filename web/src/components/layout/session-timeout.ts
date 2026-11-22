/** Oturum süresi uyarısının saf mantığı (zamanlayıcı ve arayüz `session-timeout-modal.tsx` içindedir). */

/** Süre dolmadan bu kadar önce uyarı gösterilir. */
export const WARNING_LEAD_MS = 5 * 60 * 1000;
/** `setTimeout` en çok 2^31-1 ms bekleyebilir; daha uzun beklemeler bu üst sınırla parçalanır. */
export const MAX_TIMER_MS = 2_147_483_647;

/** `/api/auth/get-session` yanıtından oturum bitiş zamanını (ms) okur; oturum yoksa ya da biçim bozuksa null. */
export function parseSessionExpiry(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null || !("session" in payload)) return null;
  const session = payload.session;
  if (typeof session !== "object" || session === null || !("expiresAt" in session)) return null;
  const value = session.expiresAt;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Uyarıya kadar beklenecek süre (ms); uyarı zamanı geçmişse 0. */
export function msUntilWarning(expiresAt: number, now: number, lead: number = WARNING_LEAD_MS): number {
  return Math.min(MAX_TIMER_MS, Math.max(0, expiresAt - lead - now));
}

/** Oturumun bitmesine kalan süre (ms); negatif olmaz. */
export function remainingMs(expiresAt: number, now: number): number {
  return Math.max(0, expiresAt - now);
}

/** "4:07" biçiminde kalan süre. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
