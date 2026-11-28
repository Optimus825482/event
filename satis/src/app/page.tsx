import { HeroCarousel } from "@/components/home/hero-carousel";
import { ReelCard } from "@/components/home/reel-card";
import { HOME_CARD_COUNT, toHeroSlides } from "@/components/home/slides";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SITE_NAME } from "@/content/site";
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
      <section aria-labelledby="gelecek-baslik" className="page-gutter mx-auto max-w-[1320px] pt-[60px] pb-[76px]">
        <div className="mb-[26px] flex flex-wrap items-end justify-between gap-4">
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-[18px]">
            {cards.map((event) => (
              <ReelCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
