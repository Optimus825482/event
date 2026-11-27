"use client";

import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Görsel; yüklenemezse yedeğe düşer. `stillSrc` verilirse `src` hareketli kabul edilir: azaltılmış hareket
 * tercihinde tarayıcı JS'siz olarak `<picture>` kaynağından sabit görseli seçer. Hareketli görsel
 * yüklenemezse önce sabit görsele, o da yüklenemezse yedeğe düşülür.
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

  const motionOk = src !== null && !failed.includes(src);
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
