import type { Metadata } from "next";
import { Notice } from "@/components/ui/notice";
import { LEGAL_PAGES, LEGAL_PLACEHOLDER_NOTICE } from "@/content/legal";

export const metadata: Metadata = { title: LEGAL_PAGES.mesafeliSatis.title };

export default function MesafeliSatisPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-3xl font-semibold text-gold">{LEGAL_PAGES.mesafeliSatis.title}</h1>
      <Notice tone="demo" data-placeholder="legal">
        {LEGAL_PLACEHOLDER_NOTICE}
      </Notice>
    </main>
  );
}
