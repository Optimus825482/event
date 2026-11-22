import { db } from "@/db/client";
import { subscribe } from "@/features/realtime/hub";
import { ensureListening } from "@/features/realtime/listener";
import { publish } from "@/features/realtime/publish";
import { waitFor } from "./helpers";

const FLUSH_ID = "flush-marker";

/**
 * Bir etkinliğe yayılan olayları toplar. `settled()` bir işaretçi olay yayıp bekler: bildirimler commit
 * sırasıyla teslim edildiği için işaretçi geldiğinde öncesindeki tüm olaylar da gelmiştir.
 */
export async function watchEvents(eventId: string) {
  await ensureListening();
  const received: Array<{ type: string; id?: string }> = [];
  let flushes = 0;
  const unsubscribe = subscribe(eventId, (message) => {
    if (message.kind !== "event") return;
    if (message.event.id === FLUSH_ID) {
      flushes += 1;
      return;
    }
    received.push({ type: message.event.type, ...(message.event.id ? { id: message.event.id } : {}) });
  });
  return {
    stop: unsubscribe,
    async settled(): Promise<string[]> {
      const target = flushes + 1;
      await publish(db, { type: "notification.created", eventId, id: FLUSH_ID });
      await waitFor(() => flushes >= target, 5000, "işaretçi olayı");
      return received.map((e) => e.type);
    },
    events: () => received,
    /** Kurulum sırasında yayılmış olayları bekler ve unutur; sonraki `settled()` yalnızca yenileri içerir. */
    async discardSetup(): Promise<void> {
      await this.settled();
      received.length = 0;
    },
  };
}
