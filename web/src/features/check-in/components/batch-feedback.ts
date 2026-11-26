import type { SettledEvent } from "../offline/queue-core";

export type BatchTally = { checkedIn: number; already: number; failed: number; queued: number };

/** Verilen anahtarların her biri için SON olay sayılır; olayı gelmemiş ya da ertelenmiş öğe "kuyrukta"dır. */
export function tallyBatch(keys: readonly string[], events: readonly SettledEvent[]): BatchTally {
  const last = new Map<string, SettledEvent>();
  for (const event of events) last.set(event.item.idempotencyKey, event);
  const tally: BatchTally = { checkedIn: 0, already: 0, failed: 0, queued: 0 };
  for (const key of keys) {
    const event = last.get(key);
    if (event?.type === "done") {
      if (event.item.result?.outcome === "already_checked_in") tally.already += 1;
      else tally.checkedIn += 1;
    } else if (event?.type === "failed") tally.failed += 1;
    else tally.queued += 1;
  }
  return tally;
}

export function batchMessage(t: BatchTally): string {
  const parts: string[] = [];
  if (t.checkedIn > 0) parts.push(`${t.checkedIn} bilet içeri alındı`);
  if (t.already > 0) parts.push(`${t.already} zaten giriş yapmıştı`);
  if (t.failed > 0) parts.push(`${t.failed} reddedildi`);
  if (t.queued > 0) parts.push(`${t.queued} kuyruğa alındı`);
  return parts.join(" · ");
}
