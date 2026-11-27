import { getReader } from "@/features/plan/read";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";

export async function loadEvents(): Promise<{ events: EventCardData[] } | { error: string }> {
  try {
    const events = await getReader().events();
    return {
      events: [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    };
  } catch (error) {
    if (error instanceof CoreError) return { error: messageFor(error) };
    throw error;
  }
}
