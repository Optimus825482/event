import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ContentPage } from "@/components/content-page";
import { buttonClass } from "@/components/ui/button";
import { FAQ, FAQ_INTRO } from "@/content/faq";

export const metadata: Metadata = {
  title: "Sık Sorulan Sorular",
};

const INLINE_LINKS: { label: string; href: string }[] = [
  { label: "Biletim (PNR)", href: "/biletimi-bul" },
  { label: "İade Koşulları", href: "/iade" },
];

function AnswerText({ text }: { text: string }) {
  const match = INLINE_LINKS.find((l) => text.includes(l.label));
  if (!match) return <>{text}</>;
  const parts = text.split(match.label);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? (
            <Link href={match.href} className="text-gold-bright underline">
              {match.label}
            </Link>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export default function FaqPage() {
  return (
    <ContentPage eyebrow={FAQ_INTRO.eyebrow} title={FAQ_INTRO.title}>
      <div className="space-y-3">
        {FAQ.map((item, i) => (
          <details
            key={item.q}
            open={i === 0}
            className="rounded-[16px] border border-line bg-surface-raised p-5"
          >
            <summary className="cursor-pointer font-serif text-xl text-ivory">{item.q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <AnswerText text={item.a} />
            </p>
          </details>
        ))}
      </div>

      <section
        aria-label="Özel Rezervasyon"
        className="flex flex-wrap items-center justify-between gap-6 rounded-[22px] border border-line-gold bg-surface p-6"
      >
        <div className="space-y-2">
          <p className="eyebrow">Özel Rezervasyon</p>
          <h2 className="text-2xl text-ivory">Gecenin en iyi masası sizin olsun</h2>
          <p className="text-sm text-muted">Loca, kurumsal grup ve özel kutlamalar için ekibimiz sizinle plan yapsın.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="tel:+903926504000" className={buttonClass("gold")}>
            Bizi arayın
          </a>
          <a href="mailto:entertainment@merithotels.com" className={buttonClass("glass")}>
            E-posta gönderin
          </a>
        </div>
      </section>
    </ContentPage>
  );
}
