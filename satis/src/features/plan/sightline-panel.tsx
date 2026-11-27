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

export function SightlinePanel({ set, table, canLookIn3d, onLookIn3d }: SightlinePanelProps) {
  const src = sightlineSrc(set, table ? table.label : null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;
  const alt = table
    ? `${table.isLoca ? "Loca" : "Masa"} ${table.label} konumundan sahnenin temsili görünümü`
    : "Salonun temsili genel görünümü";

  return (
    <section aria-label="Sahne görüşü" className="space-y-2 rounded-xl border border-line bg-surface p-3">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- statik public/sightline/ WebP varlıkları doğrudan sunulur
        <img
          key={src}
          src={src}
          alt={alt}
          width={960}
          height={540}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="aspect-video w-full rounded-lg border border-line bg-bg object-cover"
        />
      ) : table ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 text-center">
          {canLookIn3d ? (
            <Button variant="glass" onClick={onLookIn3d}>
              3B&apos;de masadan bak
            </Button>
          ) : (
            <p className="text-sm text-muted">Bu masa için sahne görüşü fotoğrafı yok.</p>
          )}
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-line bg-bg px-4 text-center">
          <p className="text-sm text-muted">Sahne görüşü için bir masa seçin.</p>
        </div>
      )}
      <p className="text-xs text-muted">{SIGHTLINE_CAPTION}</p>
    </section>
  );
}
