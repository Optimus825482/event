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
                "grid grid-cols-1 items-center gap-[clamp(28px,5vw,60px)] min-[960px]:grid-cols-[1.05fr_0.95fr]",
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

                <dl className="flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-[14px] border border-line bg-surface px-5 py-3.5 text-sm">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-muted">Tarih:</dt>
                    <dd className="font-semibold text-ivory">{slide.dateLabel}</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-muted">Saat:</dt>
                    <dd className="font-semibold text-ivory">{slide.timeLabel}</dd>
                  </div>
                  {slide.priceLabel ? (
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-muted">Başlangıç:</dt>
                      <dd className="font-semibold text-gold-bright">{slide.priceLabel}</dd>
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

                {isCurrent && slides.length > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1">
                      {slides.map((s, dotIndex) => {
                        const isDotCurrent = dotIndex === safeIndex;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-label={`${dotIndex + 1}. etkinlik: ${s.name}`}
                            aria-current={isDotCurrent ? "true" : undefined}
                            onClick={() => setActive(dotIndex)}
                            className="inline-flex min-h-11 min-w-9 items-center justify-center bg-transparent"
                          >
                            <span
                              className={cn(
                                "block h-1 rounded-full transition-all",
                                isDotCurrent ? "w-12 bg-gold" : "w-7 bg-line",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="glass"
                        aria-label="Önceki etkinlik"
                        className="min-h-9 min-w-9 px-3 py-1.5 text-sm"
                        onClick={() => setActive((prev) => nextIndex(prev, slides.length, -1))}
                      >
                        ←
                      </Button>
                      <Button
                        variant="glass"
                        aria-label="Sonraki etkinlik"
                        className="min-h-9 min-w-9 px-3 py-1.5 text-sm"
                        onClick={() => setActive((prev) => nextIndex(prev, slides.length, 1))}
                      >
                        →
                      </Button>
                      {!reducedMotion ? (
                        <Button
                          variant="ghost"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          onClick={() => setPaused((p) => !p)}
                        >
                          {paused ? "Oynat" : "Duraklat"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative mx-auto aspect-[9/11] max-h-[540px] w-full max-w-[440px] overflow-hidden rounded-[22px] border border-line-gold bg-surface shadow-2xl">
                <EventImage
                  src={slide.image}
                  alt={slide.artistName ?? slide.name}
                  priority={i === 0}
                  className="h-full w-full object-cover object-[center_15%]"
                  fallback={
                    <PosterFallback
                      title={slide.artistName ?? slide.name}
                      subtitle={slide.dateLabel}
                      className="h-full w-full"
                    />
                  }
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-bg via-bg/80 to-transparent px-5 pb-5 pt-14">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold tracking-[0.08em] text-gold-bright uppercase">
                      {slide.artistName ?? slide.name}
                    </p>
                    {slide.priceLabel ? (
                      <p className="text-sm text-muted">
                        Başlangıç: <strong className="font-semibold text-ivory">{slide.priceLabel}</strong> / kişi
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
