"use client";

import { useEffect } from "react";

/** Üretimde ya da `NEXT_PUBLIC_ENABLE_SW=1` ile açıkça istenirse kaydedilir; dev HMR'yi bozmaz. */
export function serviceWorkerEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
}

function staticAssetUrls(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => {
      try {
        const url = new URL(name);
        return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
      } catch {
        return false;
      }
    });
}

/**
 * Service worker'ı kaydeder ve çevrimiçiyken kabuğu ısıtır: bu sayfanın HTML'i ve yüklenmiş statik
 * dosyalar (ilk yüklemede sayfa henüz worker tarafından denetlenmediği için kendiliğinden
 * önbelleğe girmez). Görünmez bileşen.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!serviceWorkerEnabled() || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled || !registration.active) return;
        registration.active.postMessage({
          type: "warm",
          urls: [`${location.origin}${location.pathname}`, `${location.origin}/check-in`, ...staticAssetUrls()],
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
