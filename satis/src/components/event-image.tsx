"use client";

import { useEffect, useRef, useState } from "react";

export function EventImage({
  src,
  alt,
  fallback,
  className,
  priority,
}: {
  src: string | null;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  priority?: boolean;
}): React.JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const failed = src === null || failedSrc === src;

  useEffect(() => {
    const el = imgRef.current;
    if (src && el && el.complete && el.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  if (failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
