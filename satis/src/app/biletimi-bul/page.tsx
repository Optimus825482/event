import type { Metadata } from "next";
import { LookupForm } from "@/features/ticket/lookup-form";

export const metadata: Metadata = { title: "Biletimi bul", robots: { index: false, follow: false } };

export default function LookupPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="m-0 text-3xl font-semibold text-gold">Biletimi bul</h1>
      <p className="m-0 text-ivory">E-biletinize ulaşmak için PNR kodunuzu ve siparişteki soyadı girin.</p>
      <LookupForm />
    </main>
  );
}
