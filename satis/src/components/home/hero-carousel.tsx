"use client";

import { useEffect, useState } from "react";
import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AUTO_ADVANCE_MS, nextIndex, shouldAutoAdvance, type HeroSlide } from "./slides";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }): React.JSX.Element | null {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hoverOrFocus, setHoverOrFocus] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const canAutoAdvance = shouldAutoAdvance({
    slideCount: slides.length,
    reducedMotion,
    paused: paused || hoverOrFocus,
  });

  useEffect(() => {
    if (!canAutoAdvance) return;
    const id = window.setInterval(() => {
      setActive((prev) => nextIndex(prev, slides.length, 1));
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [canAutoAdvance, slides.length]);

  if (slides.length === 0) return null;

  const safeIndex = active < slides.length ? active : 0;

  return (
    <section
      aria-roledescription="karusel"
      aria-label="En yakın etkinlikler"
      className="hero-glow border-b border-line"
      onMouseEnter={() => setHoverOrFocus(true)}
      onMouseLeave={() => setHoverOrFocus(false)}
      onFocus={() => setHoverOrFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverOrFocus(false);
      }}
    >
      <div className="page-gutter mx-auto max-w-[1320px] py-10 sm:py-14">
        {slides.map((slide, i) => {
          const isCurrent = i === safeIndex;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slayt"
              aria-label={`${i + 1} / ${slides.length}`}
              hidden={!isCurrent}
              className={cn(
                "grid grid-cols-1 items-center gap-8 min-[960px]:grid-cols-[1.1fr_0.9fr]",
                !isCurrent && "hidden",
              )}
            >
              <div className="space-y-5">
                <p className="eyebrow">{`${slide.dateLabel} · Saat ${slide.timeLabel}`}</p>
                <div className="space-y-2">
                  <h2 className="text-[clamp(32px,6.2vw,76px)] text-ivory">{slide.name}</h2>
                  {slide.artistName ? (
                    <p className="font-serif text-2xl italic text-gold-bright">{slide.artistName}</p>
                  ) : null}
                </div>

                {slide.isDemo ? (
                  <span className="inline-block rounded-full border border-gold px-3 py-0.5 text-xs font-semibold text-gold">
                    DEMO
                  </span>
                ) : null}

                <dl className="grid grid-cols-1 gap-3 rounded-[14px] border border-line bg-surface p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Tarih</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ivory">{slide.dateLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Saat</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ivory">{slide.timeLabel}</dd>
                  </div>
                  {slide.priceLabel ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Başlangıç</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-gold-bright">{slide.priceLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="flex flex-wrap items-center gap-3">
                  {slide.open ? (
                    <ButtonLink href={`/etkinlik/${slide.id}#bilet-al`} variant="gold" size="lg">
                      Bilet Al
                    </ButtonLink>
                  ) : (
                    <span className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-muted">
                      {slide.stateLabel}
                    </span>
                  )}
                  <ButtonLink href={`/etkinlik/${slide.id}`} variant="glass">
                    Detaylar
                  </ButtonLink>
                  <ButtonLink href="/takvim" variant="ghost">
                    Etkinlik Takvimi →
                  </ButtonLink>
                </div>
              </div>

              <div className="mx-auto aspect-[9/11] max-h-[540px] w-full max-w-[440px] overflow-hidden rounded-[22px] border border-line-gold bg-surface">
                <EventImage
                  src={slide.image}
                  alt={slide.artistName ?? slide.name}
                  priority={i === 0}
                  className="h-full w-full object-cover"
                  fallback={
                    <PosterFallback
                      title={slide.artistName ?? slide.name}
                      subtitle={slide.dateLabel}
                      className="h-full w-full"
                    />
                  }
                />
              </div>
            </div>
          );
        })}

        {slides.length > 1 ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="glass"
                aria-label="Önceki etkinlik"
                onClick={() => setActive((prev) => nextIndex(prev, slides.length, -1))}
              >
                ←
              </Button>
              <Button
                variant="glass"
                aria-label="Sonraki etkinlik"
                onClick={() => setActive((prev) => nextIndex(prev, slides.length, 1))}
              >
                →
              </Button>
              {!reducedMotion ? (
                <Button variant="ghost" onClick={() => setPaused((p) => !p)}>
                  {paused ? "Oynat" : "Duraklat"}
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              {slides.map((s, i) => {
                const isCurrent = i === safeIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`${i + 1}. etkinlik: ${s.name}`}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => setActive(i)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center bg-transparent"
                  >
                    <span
                      className={cn(
                        "block h-1 rounded-full transition-all",
                        isCurrent ? "w-12 bg-gold" : "w-7 bg-line",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
