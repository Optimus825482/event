import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_TAGLINE } from "@/content/site";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: "Merit Royal etkinlik biletleri",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce'u proxy üretir; okumak sayfaları istek başına dinamik yapar (CSP için gerekli).
  await headers();
  return (
    <html lang="tr">
      <body>
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-on-gold"
        >
          İçeriğe geç
        </a>
        <SiteHeader />
        <div id="icerik" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
