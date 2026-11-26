import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merit Royal Bilet",
  description: "Merit Royal etkinlik biletleri",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce'u proxy üretir; okumak sayfaları istek başına dinamik yapar (CSP için gerekli).
  await headers();
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
