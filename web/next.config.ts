import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 10 MB'a kadar Excel yüklemeleri sunucu eylemine ulaşsın (varsayılan 1 MB).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
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
