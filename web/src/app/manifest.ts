import type { MetadataRoute } from "next";

/** PWA bildirimi: kapı personeli ana ekrana ekleyip doğrudan check-in'e açar. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EventFlow Kapı Girişi",
    short_name: "EventFlow",
    description: "Etkinlik kapı girişi (QR check-in), çevrimdışı kuyruklu",
    lang: "tr",
    start_url: "/check-in",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
