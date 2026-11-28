import type { Metadata } from "next";
import { LookupForm } from "@/features/ticket/lookup-form";

export const metadata: Metadata = { title: "Biletim (PNR)", robots: { index: false, follow: false } };

export default function LookupPage() {
  return (
    <main className="page-gutter mx-auto flex max-w-[960px] flex-col gap-3 py-12 sm:py-[84px]">
      <p className="eyebrow">E-Bilet Merkezi</p>
      <h1 className="m-0 text-[clamp(34px,5vw,56px)] text-ivory">Biletim (PNR)</h1>
      <p className="m-0 text-muted">
        PNR kodunuzu ve siparişteki soyadınızı girerek e-biletinizi görüntüleyin, yazdırın veya takviminize ekleyin.
      </p>
      <LookupForm />
    </main>
  );
}
