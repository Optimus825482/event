import { HeroCarousel } from "@/components/home/hero-carousel";
import { HOME_CARD_COUNT, toHeroSlides } from "@/components/home/slides";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SITE_NAME } from "@/content/site";
import { EventCard } from "@/features/plan/event-card";
import { loadEvents } from "./_lib/load-events";

// Her istekte çekirdek önbelleğinden okunur; derlemede çekirdeğe gidilmez.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadEvents();

  if ("error" in result) {
    return (
      <main className="page-gutter mx-auto max-w-[1320px] py-12">
        <h1 className="sr-only">Konser ve Gala Biletleri</h1>
        <Notice tone="error">{result.error}</Notice>
      </main>
    );
  }

  const slides = toHeroSlides(result.events);
  const cards = result.events.slice(0, HOME_CARD_COUNT);

  return (
    <main>
      <h1 className="sr-only">Konser ve Gala Biletleri</h1>
      <HeroCarousel slides={slides} />
      <section aria-labelledby="gelecek-baslik" className="page-gutter mx-auto max-w-[1320px] py-12 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="eyebrow">{SITE_NAME}</p>
            <h2 id="gelecek-baslik" className="text-[clamp(30px,4vw,44px)] text-ivory">
              Gelecek Organizasyonlar
            </h2>
          </div>
          <ButtonLink href="/etkinlikler" variant="glass">
            Tüm Yaklaşan Etkinlikler →
          </ButtonLink>
        </div>

        {cards.length === 0 ? (
          <Notice>Şu anda satışta etkinlik yok.</Notice>
        ) : (
          <div className="card-grid">
            {cards.map((event) => (
              <EventCard key={event.id} event={event} headingLevel={3} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
