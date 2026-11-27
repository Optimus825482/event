import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { Notice } from "@/components/ui/notice";
import { LEGAL_PAGES, LEGAL_PLACEHOLDER_NOTICE } from "@/content/legal";

export const metadata: Metadata = { title: LEGAL_PAGES.kvkk.title };

export default function KvkkPage() {
  return (
    <ContentPage eyebrow="Yasal" title={LEGAL_PAGES.kvkk.title}>
      <Notice tone="demo" data-placeholder="legal">
        {LEGAL_PLACEHOLDER_NOTICE}
      </Notice>
    </ContentPage>
  );
}
