import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ABOUT } from "@/content/about";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: ABOUT.lead,
};

export default function AboutPage() {
  const { storyImage, editorial } = ABOUT;
  return (
    <main>
      <section aria-labelledby="hakkimizda-baslik" className="hero-glow">
        <div className="page-gutter mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-10 py-12 sm:py-16 min-[900px]:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <p className="eyebrow">{ABOUT.eyebrow}</p>
            <h1 id="hakkimizda-baslik" className="text-[clamp(38px,5.5vw,62px)] leading-[1.06] text-ivory">
              {ABOUT.title}
            </h1>
            <p className="font-serif text-[clamp(22px,2.8vw,28px)] leading-snug text-ivory">{ABOUT.lead}</p>
            {ABOUT.story.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="max-w-[68ch] text-base leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            <ButtonLink href={ABOUT.storyCta.href} variant="gold">
              {ABOUT.storyCta.label}
            </ButtonLink>
          </div>

          <figure className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[22px] border border-line-gold bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- statik public/hakkimizda/ WebP varlıkları doğrudan sunulur */}
            <img
              src={storyImage.src}
              alt={storyImage.alt}
              width={storyImage.width}
              height={storyImage.height}
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/5] h-auto w-full object-cover object-[center_15%]"
            />
            <figcaption className="space-y-0.5 border-t border-line px-5 py-4">
              <strong className="block text-sm font-semibold text-gold-bright">{storyImage.name}</strong>
              <span className="block text-sm text-muted">{storyImage.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-label={ABOUT.factsLabel} className="border-y border-line bg-surface">
        <dl className="page-gutter mx-auto grid max-w-[1180px] grid-cols-2 gap-6 py-8 sm:grid-cols-3 min-[900px]:grid-cols-5">
          {ABOUT.facts.map((fact) => (
            <div key={fact.label} className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{fact.label}</dt>
              <dd className="font-serif text-[clamp(24px,3vw,32px)] text-gold-bright">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="kurgu-baslik" className="page-gutter mx-auto max-w-[1180px] py-14 sm:py-20">
        <div className="grid grid-cols-1 gap-8 min-[900px]:grid-cols-[0.8fr_1.2fr]">
          <h2 id="kurgu-baslik" className="text-[clamp(30px,4vw,44px)] text-ivory">
            {editorial.title} <em className="text-gold-bright">{editorial.titleAccent}</em>
          </h2>
          <div className="space-y-5">
            {editorial.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="text-base leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            <ButtonLink href={editorial.link.href} variant="ghost">
              {editorial.link.label}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="ayricalik-baslik" className="page-gutter mx-auto max-w-[1180px] pb-14 sm:pb-20">
        <h2 id="ayricalik-baslik" className="mb-6 text-[clamp(30px,4vw,44px)] text-ivory">
          {ABOUT.cardsTitle}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {ABOUT.cards.map((card) => (
            <section key={card.title} className="space-y-2 rounded-[16px] border border-line bg-surface-raised p-5">
              <h3 className="text-2xl text-gold-bright">{card.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{card.text}</p>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="sahneler-baslik" className="page-gutter mx-auto max-w-[1180px] pb-4">
        <h2 id="sahneler-baslik" className="mb-6 text-[clamp(30px,4vw,44px)] text-ivory">
          {ABOUT.venuesTitle}
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {ABOUT.venues.map((venue) => (
            <li key={venue.src} className="overflow-hidden rounded-[18px] border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- statik public/hakkimizda/ WebP varlıkları doğrudan sunulur */}
              <img
                src={venue.src}
                alt={venue.alt}
                width={venue.width}
                height={venue.height}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] h-auto w-full object-cover"
              />
              <div className="space-y-0.5 px-5 py-4">
                <h3 className="text-xl text-ivory">{venue.name}</h3>
                <p className="text-sm text-muted">{venue.place}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
