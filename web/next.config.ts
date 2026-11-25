import type { NextConfig } from "next";
import { LEGACY_LEADER_REDIRECTS } from "./src/features/reviews/legacy-redirects";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // E2E sunucusu (Playwright) geliştirme sunucusunun `.next` klasörüne dokunmasın diye ayrı dizin kullanır.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Sürüm bilgisini sızdıran `X-Powered-By` başlığı gönderilmez.
  poweredByHeader: false,
  experimental: {
    // 10 MB'a kadar Excel yüklemeleri sunucu eylemine ulaşsın (varsayılan 1 MB).
    serverActions: { bodySizeLimit: "11mb" },
    // `forbidden.tsx` ve 403 durum kodu (yetkisiz kullanıcı için, bkz. features/auth/errors.ts).
    authInterrupts: true,
  },
  async redirects() {
    return [...LEGACY_LEADER_REDIRECTS];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") },
      {
        // Service worker ve yönlendirme betiği hep güncel alınır; yeni sürüm hemen fark edilsin.
        source: "/:file(sw|sw-routing).js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
