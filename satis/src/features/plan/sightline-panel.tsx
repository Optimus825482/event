"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SightlineSet } from "@/lib/core/contract";
import { SIGHTLINE_CAPTION, sightlineSrc } from "./sightline";

export type SightlinePanelProps = {
  set: SightlineSet | null;
  table: { label: string; isLoca: boolean } | null;
  /** 3B açılabiliyor mu (cihaz uygun, hata yok). */
  canLookIn3d: boolean;
  onLookIn3d(): void;
};

/** Seçili masadan sahnenin temsili fotoğrafı (panel genişliğinde) ve 3B göz hizası düğmesi. */
export function SightlinePanel({ set, table, canLookIn3d, onLookIn3d }: SightlinePanelProps) {
  const src = sightlineSrc(set, table ? table.label : null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;
  const name = table ? `${table.isLoca ? "Loca" : "Masa"} ${table.label}` : null;
  const title = name ? `${name} · Sahne görüşü` : "Salon ortasından sahne görüşü";
  const alt = name ? `${name} konumundan sahnenin temsili görünümü` : "Salonun temsili genel görünümü";

  return (
    <section aria-label="Sahne görüşü" className="overflow-hidden rounded-xl border border-line bg-surface">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- statik public/sightline/ WebP varlıkları doğrudan sunulur
        <img
          key={src}
          src={src}
          alt={alt}
          width={960}
          height={540}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="aspect-video w-full bg-bg object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-bg px-4 text-center">
          <p className="text-sm text-muted">
            {table ? "Bu masa için sahne görüşü fotoğrafı yok." : "Sahne görüşü için bir masa seçin."}
          </p>
        </div>
      )}
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-ivory">{title}</p>
          <p className="text-xs text-muted">{SIGHTLINE_CAPTION}</p>
        </div>
        {table && canLookIn3d ? (
          <Button variant="glass" className="w-full" onClick={onLookIn3d}>
            3B&apos;de masadan bak
          </Button>
        ) : null}
      </div>
    </section>
  );
}
