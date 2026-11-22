import type { Metadata } from "next";
import { headers } from "next/headers";
import { NonceProvider } from "@/components/nonce-provider";
import { PendingSignOut } from "@/components/layout/pending-sign-out";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventFlow",
  description: "Etkinlik yönetim sistemi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce'u proxy üretir (`src/proxy.ts`); okumak sayfaları istek başına dinamik yapar (CSP için zaten gerekli).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="tr">
      <body>
        <NonceProvider nonce={nonce}>
          <div id="app-root">{children}</div>
        </NonceProvider>
        <PendingSignOut />
      </body>
    </html>
  );
}
