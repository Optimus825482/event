import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable image optimization for Docker
  images: {
    unoptimized: true,
  },
  // Tree shaking optimizasyonu - lucide-react bundle size'ı düşürür
  // NOT: lucide-react zaten ESM modül olduğu için Next.js otomatik tree shaking yapıyor
  // modularizeImports kaldırıldı çünkü lucide-react v0.460+ ile uyumsuz
};

export default withBundleAnalyzer(nextConfig);
