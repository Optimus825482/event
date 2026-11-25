import { describe, expect, it } from "vitest";
import { keysToInvalidate, realtimeKeys } from "@/features/realtime/keys";

const eventId = "6f1c1d3e-0000-4000-8000-000000000001";
const at = new Date().toISOString();

describe("realtimeKeys / keysToInvalidate", () => {
  it("anahtarlar etkinlik önekiyle başlar (önek geçersiz kılma tüm etkinlik verisini kapsar)", () => {
    for (const key of [
      realtimeKeys.reservations(eventId),
      realtimeKeys.checkIns(eventId),
      realtimeKeys.tables(eventId),
      realtimeKeys.stats(eventId),
    ]) {
      expect(key.slice(0, 2)).toEqual(realtimeKeys.event(eventId));
    }
  });

  it("olay türüne göre geçersiz kılınacak anahtarlar", () => {
    expect(keysToInvalidate({ type: "reservation.changed", eventId, at }, eventId)).toEqual([
      realtimeKeys.reservations(eventId),
      realtimeKeys.tables(eventId),
      realtimeKeys.stats(eventId),
    ]);
    expect(keysToInvalidate({ type: "guest.checked_in", eventId, at }, eventId)).toEqual([
      realtimeKeys.checkIns(eventId),
      realtimeKeys.reservations(eventId),
      realtimeKeys.stats(eventId),
    ]);
    expect(keysToInvalidate({ type: "table.updated", eventId, at }, eventId)).toEqual([realtimeKeys.tables(eventId)]);
    expect(keysToInvalidate({ type: "stats.updated", eventId, at }, eventId)).toEqual([realtimeKeys.stats(eventId)]);
    expect(keysToInvalidate({ type: "notification.created", audience: "all", at }, eventId)).toEqual([
      realtimeKeys.notifications(),
    ]);
    expect(keysToInvalidate("resync", eventId)).toEqual([realtimeKeys.event(eventId), realtimeKeys.notifications()]);
  });
});
