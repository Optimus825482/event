import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { EventSales } from "@/features/plan/event-sales";
import { parsePartySize } from "@/features/plan/party";
import { getReader } from "@/features/plan/read";
import { saleStateLabel } from "@/features/plan/sale-state";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";
import { formatEventWhen } from "@/lib/time-zone";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await getReader().event(eventId);
    return event ? { title: event.name } : {};
  } catch {
    return {};
  }
}

async function loadAvailability(eventId: string): Promise<Availability | null> {
  try {
    return await getReader().availability(eventId);
  } catch (error) {
    if (error instanceof CoreError) return null;
    throw error;
  }
}

function Header({ event }: { event: EventDetail }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-3xl font-semibold text-gold">{event.name}</h1>
      <p className="text-ivory">{formatEventWhen(event.startsAt)}</p>
      {event.artistName ? <p className="text-muted">{event.artistName}</p> : null}
      {event.description ? <p className="text-ivory">{event.description}</p> : null}
    </header>
  );
}

export default async function EventPage({ params, searchParams }: PageProps) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);

  let event: EventDetail | null;
  try {
    event = await getReader().event(eventId);
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Notice tone="error">{messageFor(error)}</Notice>
      </main>
    );
  }
  if (!event) notFound();

  const availability = await loadAvailability(eventId);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <Header event={event} />
      {event.sale.state !== "open" ? <Notice>{saleStateLabel(event.sale.state)}</Notice> : null}
      <p className="text-muted">Fiyatlar sandalye başınadır; salon planından masa seçilir.</p>
      {availability ? (
        <section id="masa-secimi">
          <EventSales
            event={event}
            initialAvailability={availability}
            initialPartySize={parsePartySize(sp.kisi, event.sale.maxSeatsPerOrder)}
          />
        </section>
      ) : (
        <Notice tone="error">Canlı masa durumu alınamadı. Sayfayı yenileyin.</Notice>
      )}
    </main>
  );
}
