import type { Metadata } from "next";
import { ABOUT } from "@/content/about";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: ABOUT.lead,
};

export default function AboutPage() {
  return (
    <main className="page-gutter mx-auto max-w-[1040px] py-14 sm:py-[84px]">
      <p className="eyebrow mb-3">{ABOUT.eyebrow}</p>
      <h1 className="mb-5 text-[clamp(38px,5.5vw,62px)] leading-[1.06] text-ivory">{ABOUT.title}</h1>
      <p className="mb-8 font-serif text-[clamp(22px,2.8vw,28px)] leading-[1.45] text-ivory">{ABOUT.lead}</p>

      <div className="space-y-4">
        {ABOUT.story.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="text-[15.5px] leading-[1.7] text-muted">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[18px]">
        {ABOUT.cards.map((card) => (
          <section key={card.title} className="rounded-[16px] border border-line bg-surface p-[22px]">
            <h2 className="mb-2 font-serif text-2xl text-gold-bright">{card.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{card.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
