"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** İçeriği (sabit px boyutlu davetiye) dar ekranlarda sığacak kadar küçültür; büyütmez. */
export function FitToWidth({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={host} className="w-full" style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
