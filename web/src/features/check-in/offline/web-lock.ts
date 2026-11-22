import type { TryLock } from "./flusher";

const LOCK_NAME = "eventflow-check-in-flush";

/**
 * Sekmeler arası tek boşaltma: Web Locks varsa kilit başka sekmede tutuluyorsa BEKLEMEDEN vazgeçer
 * (o sekme zaten boşaltıyor; sonucu BroadcastChannel ile duyurur). Yoksa yalnızca sekme içi koruma
 * kalır; aynı öğenin iki sekmeden gönderilmesi sunucuda aynı anahtarla tek sonuca iner.
 */
export const tryWebLock: TryLock = async (fn) => {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    await fn();
    return true;
  }
  return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (!lock) return false;
    await fn();
    return true;
  });
};
