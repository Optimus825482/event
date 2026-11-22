import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E sunucusu (Playwright) geliştirme sunucusunun `.next` klasörüne dokunmasın diye ayrı dizin kullanır.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // 10 MB'a kadar Excel yüklemeleri sunucu eylemine ulaşsın (varsayılan 1 MB).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    // Service worker ve yönlendirme betiği hep güncel alınır; yeni sürüm hemen fark edilsin.
    return [
      {
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
