import type { Availability } from "@/lib/core/contract";

export const POLL_BASE_MS = 5000;
export const POLL_JITTER_MS = 1000;
export const STALE_AFTER_FAILURES = 3;

/** Sonraki sorgulamaya kalan süre: 5 sn ± 1 sn, [4000, 6000). */
export function nextPollDelay(random: () => number = Math.random): number {
  return POLL_BASE_MS - POLL_JITTER_MS + random() * 2 * POLL_JITTER_MS;
}

const time = (at: string): number => {
  const value = Date.parse(at);
  return Number.isNaN(value) ? 0 : value;
};

/** Daha eski zaman damgalı yanıt güncel durumu geri almaz. */
export function applyAvailability(current: Availability, incoming: Availability): Availability {
  return time(incoming.at) < time(current.at) ? current : incoming;
}
