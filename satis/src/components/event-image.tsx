"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const VIDEO_EXTENSION = ".webm";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
/** Sunucuda tercih bilinmez: video hiç çizilmez, hidrasyondan sonra tarayıcı karar verir. */
const serverPrefersReducedMotion = () => true;

/**
 * Görsel; yüklenemezse yedeğe düşer. `stillSrc` verilirse `src` hareketli kabul edilir: azaltılmış hareket
 * tercihinde tarayıcı JS'siz olarak `<picture>` kaynağından sabit görseli seçer. Hareketli görsel
 * yüklenemezse önce sabit görsele, o da yüklenemezse yedeğe düşülür.
 *
 * `src` WebM ise (yalnızca hero) sessiz, döngülü `<video>` çizilir; `stillSrc` poster olur. Azaltılmış hareket
 * tercihinde ve sunucu çiziminde video yerine sabit görsel gösterilir.
 */
export function EventImage({
  src,
  stillSrc,
  alt,
  fallback,
  className,
  priority,
}: {
  src: string | null;
  stillSrc?: string | null;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  priority?: boolean;
}): React.JSX.Element {
  const [failed, setFailed] = useState<readonly string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverPrefersReducedMotion);

  const isVideo = src !== null && src.endsWith(VIDEO_EXTENSION);
  const motionOk = src !== null && !failed.includes(src) && !(isVideo && reducedMotion);
  const still = stillSrc && !failed.includes(stillSrc) ? stillSrc : null;
  const current = motionOk ? src : still;

  const markFailed = (path: string) => setFailed((prev) => (prev.includes(path) ? prev : [...prev, path]));

  useEffect(() => {
    const el = imgRef.current;
    if (current && el && el.complete && el.naturalWidth === 0) {
      setFailed((prev) => (prev.includes(current) ? prev : [...prev, current]));
    }
  }, [current]);

  if (current === null) {
    return <>{fallback}</>;
  }

  if (current === src && isVideo) {
    return (
      <video
        key={current}
        src={current}
        poster={still ?? undefined}
        aria-label={alt}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={className}
        onError={() => markFailed(current)}
      />
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- /api/gorsel vekil rotası; hareketli WebP optimize edilmemeli
    <img
      ref={imgRef}
      src={current}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
      onError={() => markFailed(current)}
    />
  );

  if (current === src && still) {
    return (
      <picture className="contents">
        <source media={REDUCED_MOTION} srcSet={still} />
        {img}
      </picture>
    );
  }
  return img;
}
