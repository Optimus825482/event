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
    // Sunucu eylemi gövde sınırı (varsayılan 1 MB): 10 MB Excel ve 50 MB hero videosu (sunucuda sıkıştırılır,
    // bkz. features/uploads/video-compress.ts) + multipart payı. Next.js bu sınırı yalnız genel olarak sunar
    // (eylem başına değil); her eylem kendi dosya boyutu sınırını ayrıca uygular.
    serverActions: { bodySizeLimit: "55mb" },
    // `src/proxy.ts` tüm istekleri karşıladığından gövde ara belleğe alınır (varsayılan 10 MB'ta kesilir);
    // sunucu eylemi sınırıyla aynı tutulur, yoksa büyük yüklemeler yarım gövdeyle ulaşır.
    proxyClientMaxBodySize: "55mb",
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
