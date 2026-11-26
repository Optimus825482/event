/** Geri sayım yardımcıları; cihaz saatine değil, sunucu saatine göre türetilir. */

/** Bırakma anına kalan süre (ms); geçersiz zaman damgasında ve süre dolunca 0. */
export function remainingMs(holdExpiresAt: string, nowMs: number): number {
  const expires = Date.parse(holdExpiresAt);
  if (Number.isNaN(expires)) return 0;
  return Math.max(0, expires - nowMs);
}

/** `mm:ss`; saniye yukarı yuvarlanır (999 ms -> 00:01). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Sunucu saati - cihaz saati (ms); cihaz geride ise pozitif. */
export function clockSkewMs(serverNowIso: string, clientNowMs: number): number {
  return Date.parse(serverNowIso) - clientNowMs;
}
