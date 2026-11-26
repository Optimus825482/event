import { describe, expect, it } from "vitest";
import { decodeRealtimeEvent, encodeRealtimeEvent, RealtimePayloadError } from "@/features/realtime/events";
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

  it("yeni olay türleri sözleşmedeki anahtarları geçersiz kılar", () => {
    const k = realtimeKeys;
    expect(keysToInvalidate({ type: "allocation.changed", eventId, at }, eventId)).toEqual([k.tables(eventId), k.reservations(eventId), k.seats(eventId), k.orders(eventId)]);
    expect(keysToInvalidate({ type: "seats.changed", eventId, at }, eventId)).toEqual([k.seats(eventId), k.tables(eventId), k.orders(eventId)]);
    expect(keysToInvalidate({ type: "order.paid", eventId, at }, eventId)).toEqual([k.orders(eventId), k.stats(eventId), k.seats(eventId)]);
    expect(keysToInvalidate({ type: "sales.changed", eventId, at }, eventId)).toEqual([k.sales(eventId), k.event(eventId), k.seats(eventId)]);
    expect(k.seats(eventId)).toEqual(["events", eventId, "seats"]);
    expect(k.orders(eventId)).toEqual(["events", eventId, "orders"]);
    expect(k.sales(eventId)).toEqual(["events", eventId, "sales"]);
  });

  it("yeni olaylar kodlanır; etkinliksiz yük reddedilir", () => {
    const payload = encodeRealtimeEvent({ type: "seats.changed", eventId });
    expect(decodeRealtimeEvent(payload)).toMatchObject({ type: "seats.changed", eventId });
    expect(() => encodeRealtimeEvent({ type: "sales.changed" } as never)).toThrow(RealtimePayloadError);
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
