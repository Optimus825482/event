import type { RealtimeEvent } from "./events";

/**
 * TanStack Query anahtar sözleşmesi. Canlı güncelleme alan ekranlar sorgularını bu
 * anahtarlarla (veya bunlarla başlayan daha uzun anahtarlarla) tanımlar; böylece
 * `useEventStream` gelen olayda doğru önbelleği geçersiz kılar. Geçersiz kılma
 * önek eşleşmesiyle çalışır: `["events", id, "reservations", { page: 2 }]` da
 * `realtimeKeys.reservations(id)` ile geçersiz kılınır.
 */
export const realtimeKeys = {
  event: (eventId: string) => ["events", eventId] as const,
  reservations: (eventId: string) => ["events", eventId, "reservations"] as const,
  checkIns: (eventId: string) => ["events", eventId, "check-in"] as const,
  tables: (eventId: string) => ["events", eventId, "tables"] as const,
  stats: (eventId: string) => ["events", eventId, "stats"] as const,
  notifications: () => ["notifications"] as const,
};

export type RealtimeQueryKey = readonly string[];

/** Olay (veya yeniden eşitleme) için geçersiz kılınacak anahtarlar. */
export function keysToInvalidate(event: RealtimeEvent | "resync", eventId: string): RealtimeQueryKey[] {
  if (event === "resync") return [realtimeKeys.event(eventId), realtimeKeys.notifications()];
  switch (event.type) {
    case "reservation.changed":
      return [realtimeKeys.reservations(eventId), realtimeKeys.tables(eventId), realtimeKeys.stats(eventId)];
    case "guest.checked_in":
      return [realtimeKeys.checkIns(eventId), realtimeKeys.reservations(eventId), realtimeKeys.stats(eventId)];
    case "table.updated":
      return [realtimeKeys.tables(eventId)];
    case "stats.updated":
      return [realtimeKeys.stats(eventId)];
    case "notification.created":
      return [realtimeKeys.notifications()];
  }
}
