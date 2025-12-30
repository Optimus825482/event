import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import withPWAInit from "@ducanh2912/next-pwa";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheStartUrl: true,
  dynamicStartUrl: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // Check-in page - Network First with offline fallback (critical for check-in module)
      {
        urlPattern: /\/check-in$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "check-in-page",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          networkTimeoutSeconds: 3,
        },
      },
      // Check-in API data - Stale While Revalidate (for offline support)
      {
        urlPattern: /\/api\/.*\/(check-in|reservations|events).*$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "check-in-api",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 12 * 60 * 60, // 12 hours
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Sound files for check-in feedback - Cache First
      {
        urlPattern: /\/sounds\/.*\.(mp3|wav|ogg)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "check-in-sounds",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // Static assets - Cache First (1 year)
      {
        urlPattern: /^https?:\/\/.*\.(js|css|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // Images - Cache First (30 days)
      {
        urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      // Fonts - Cache First (1 year)
      {
        urlPattern: /^https?:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // API requests - Stale While Revalidate (24 hours)
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable image optimization for Docker
  images: {
    unoptimized: true,
  },
  // Empty turbopack config to silence the warning (PWA uses webpack)
  turbopack: {},
  // Tree shaking optimizasyonu - lucide-react bundle size'ı düşürür
  // NOT: lucide-react zaten ESM modül olduğu için Next.js otomatik tree shaking yapıyor
  // modularizeImports kaldırıldı çünkü lucide-react v0.460+ ile uyumsuz
};

// Compose plugins: PWA -> Bundle Analyzer -> Next Config
export default withBundleAnalyzer(withPWA(nextConfig));
