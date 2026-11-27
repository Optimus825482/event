import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ABOUT } from "@/content/about";

export const metadata: Metadata = {
  title: "Hakkımızda",
};

export default function AboutPage() {
  return (
    <ContentPage eyebrow={ABOUT.eyebrow} title={ABOUT.title} lead={ABOUT.lead}>
      <p className="max-w-[68ch] text-base leading-relaxed text-muted">{ABOUT.body}</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {ABOUT.cards.map((card) => (
          <section key={card.title} className="space-y-2 rounded-[16px] border border-line bg-surface-raised p-5">
            <h2 className="text-2xl text-ivory">{card.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{card.text}</p>
          </section>
        ))}
      </div>
    </ContentPage>
  );
}
