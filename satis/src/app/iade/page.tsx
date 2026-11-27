import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { Notice } from "@/components/ui/notice";
import { POLICY_DRAFT_NOTICE, REFUND_CLAUSES, REFUND_INTRO } from "@/content/refund";

export const metadata: Metadata = {
  title: "İade Koşulları",
};

export default function RefundPage() {
  return (
    <ContentPage eyebrow={REFUND_INTRO.eyebrow} title={REFUND_INTRO.title} lead={REFUND_INTRO.lead}>
      <Notice tone="demo" data-placeholder="policy">
        {POLICY_DRAFT_NOTICE}
      </Notice>

      <div className="space-y-6">
        {REFUND_CLAUSES.map((clause) => (
          <section key={clause.title} className="space-y-3 rounded-[16px] border border-line bg-surface-raised p-6">
            <h2 className="text-2xl text-ivory">{clause.title}</h2>
            {clause.paragraphs.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted">
                {p}
              </p>
            ))}
            {clause.items ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                {clause.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <p className="text-sm text-muted">
        Kişisel verilerin işlenmesine ilişkin esaslar için{" "}
        <Link href="/kvkk" className="text-gold-bright underline">
          KVKK Aydınlatma Metni
        </Link>{" "}
        sayfamızı inceleyebilirsiniz.
      </p>
    </ContentPage>
  );
}
