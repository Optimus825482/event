import { Notice } from "@/components/ui/notice";
import { EventCard } from "@/features/plan/event-card";
import { getReader } from "@/features/plan/read";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

async function load(): Promise<{ events: EventCardData[] } | { error: string }> {
  try {
    return { events: await getReader().events() };
  } catch (error) {
    if (error instanceof CoreError) return { error: messageFor(error) };
    throw error;
  }
}

export default async function HomePage() {
  const result = await load();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-3xl font-semibold text-gold">Etkinlikler</h1>
      {"error" in result ? (
        <Notice tone="error">{result.error}</Notice>
      ) : result.events.length === 0 ? (
        <Notice>Şu anda satışta etkinlik yok.</Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
