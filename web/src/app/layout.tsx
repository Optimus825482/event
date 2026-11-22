import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Roboto, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import { NonceProvider } from "@/components/nonce-provider";
import { PendingSignOut } from "@/components/layout/pending-sign-out";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"] });

const APP_NAME = "EventFlow PRO";
const APP_DEFAULT_TITLE = "EventFlow PRO - Etkinlik Yönetim Sistemi";
const APP_TITLE_TEMPLATE = "%s | EventFlow PRO";
const APP_DESCRIPTION = "Yeni nesil etkinlik yönetim, planlama ve deneyim ekosistemi";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
  description: APP_DESCRIPTION,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
  // /favicon.ico dosya kuralıyla (`app/favicon.ico`) sunulur.
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
    description: APP_DESCRIPTION,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce'u proxy üretir (`src/proxy.ts`); okumak sayfaları istek başına dinamik yapar (CSP için zaten gerekli).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="tr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} ${playfair.variable} antialiased bg-slate-900 text-white`}
      >
        <NonceProvider nonce={nonce}>
          <div id="app-root">{children}</div>
        </NonceProvider>
        <PendingSignOut />
      </body>
    </html>
  );
}
