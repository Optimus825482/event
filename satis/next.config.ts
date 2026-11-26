import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // E2E sunucusu geliştirme sunucusunun `.next` klasörüne dokunmasın diye ayrı dizin kullanır.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Sürüm bilgisini sızdıran `X-Powered-By` başlığı gönderilmez.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
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
