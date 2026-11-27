import { getReader } from "@/features/plan/read";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";

export type EventLoad = { ok: true; event: EventDetail | null } | { ok: false; message: string };

/** Etkinlik detayı (detay ve salon sayfaları ortak); çekirdek hatası iletiye çevrilir, bulunamazsa `event: null`. */
export async function loadEvent(eventId: string): Promise<EventLoad> {
  try {
    return { ok: true, event: await getReader().event(eventId) };
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    return { ok: false, message: messageFor(error) };
  }
}

export async function loadAvailability(eventId: string): Promise<Availability | null> {
  try {
    return await getReader().availability(eventId);
  } catch (error) {
    if (error instanceof CoreError) return null;
    throw error;
  }
}

export async function eventMetadataTitle(eventId: string): Promise<{ title: string; description?: string } | null> {
  try {
    const event = await getReader().event(eventId);
    return event ? { title: event.name, description: event.site.summary ?? undefined } : null;
  } catch {
    return null;
  }
}
