import { Notice } from "@/components/ui/notice";
import { EventCard } from "@/features/plan/event-card";
import { loadEvents } from "./_lib/load-events";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadEvents();
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
