import { createTtlCache } from "@/lib/cache";
import { getCore, type CoreClient } from "@/lib/core/client";
import type { Availability, EventCard, EventDetail } from "@/lib/core/contract";
import { CoreError } from "@/lib/core/errors";

/** Çekirdeğe giden okumalar için önbellekli katman (yalnızca sunucuda). */
export const EVENTS_TTL_MS = 30_000;
export const DETAIL_TTL_MS = 30_000;
export const AVAILABILITY_TTL_MS = 3_000;
export const MAX_CACHE_ENTRIES = 200;

export type Reader = {
  events(): Promise<EventCard[]>;
  event(eventId: string): Promise<EventDetail | null>;
  availability(eventId: string): Promise<Availability | null>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS_KEY = "events";

export function createReader(deps: {
  core: Pick<CoreClient, "listEvents" | "getEvent" | "getAvailability">;
  now?: () => number;
}): Reader {
  const { core, now } = deps;
  const eventsCache = createTtlCache<EventCard[]>({ ttlMs: EVENTS_TTL_MS, maxEntries: 1, now });
  const detailCache = createTtlCache<EventDetail>({ ttlMs: DETAIL_TTL_MS, maxEntries: MAX_CACHE_ENTRIES, now });
  const availabilityCache = createTtlCache<Availability>({
    ttlMs: AVAILABILITY_TTL_MS,
    maxEntries: MAX_CACHE_ENTRIES,
    now,
  });

  const events = () => eventsCache.get(EVENTS_KEY, () => core.listEvents());

  // Rastgele kimliklerle önbellek delinip çekirdeğe yük bindirilmesin: yalnızca listedeki kimlikler geçer.
  async function isListed(eventId: string): Promise<boolean> {
    if (!UUID_PATTERN.test(eventId)) return false;
    return (await events()).some((card) => card.id === eventId);
  }

  async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error) {
      if (error instanceof CoreError && error.code === "event_not_found") return null;
      throw error;
    }
  }

  return {
    events,
    async event(eventId) {
      if (!(await isListed(eventId))) return null;
      return orNull(() => detailCache.get(eventId, () => core.getEvent(eventId)));
    },
    async availability(eventId) {
      if (!(await isListed(eventId))) return null;
      return orNull(() => availabilityCache.get(eventId, () => core.getAvailability(eventId)));
    },
  };
}

let instance: Reader | undefined;

/** Ortamdan yapılandırılmış tekil okuyucu. */
export function getReader(): Reader {
  instance ??= createReader({ core: getCore() });
  return instance;
}
