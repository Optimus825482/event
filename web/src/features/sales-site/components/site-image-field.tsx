"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { removeSiteImageAction, uploadSiteImageAction } from "../actions";
import { IMAGE_SLOT_LABELS, isHeroVideoPath, type ImageSlot } from "../image-status";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
/** Yalnızca hero alanı video kabul eder (sunucu içeriği ayrıca koklar ve VP9 WebM'e sıkıştırır). */
const HERO_ACCEPT = `${IMAGE_ACCEPT},video/webm,video/mp4,video/quicktime`;
const IMAGE_HELP = "JPG, PNG veya WebP, en fazla 5 MB";
const HERO_HELP =
  "JPG, PNG, WebP görsel (en fazla 5 MB) ya da WebM/MP4/MOV video (en fazla 50 MB, 60 sn; otomatik sıkıştırılır)";
/** Sunucudaki `MAX_VIDEO_INPUT_BYTES` ile aynı; büyük dosya hiç gönderilmeden reddedilir. */
const MAX_VIDEO_INPUT_BYTES = 50 * 1024 * 1024;
const VIDEO_TOO_LARGE = "Video boyutu en fazla 50 MB olabilir";

export function SiteImageField({
  eventId,
  slot,
  path,
  canEdit,
}: {
  eventId: string;
  slot: ImageSlot;
  path: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const label = `${IMAGE_SLOT_LABELS[slot]} görseli`;
  const inputId = `site-image-${slot}`;
  const helpId = `${inputId}-help`;
  const acceptsVideo = slot === "hero";
  const previewIsVideo = acceptsVideo && isHeroVideoPath(path);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !canEdit) return;
    setError(null);
    const isVideo = acceptsVideo && file.type.startsWith("video/");
    if (isVideo && file.size > MAX_VIDEO_INPUT_BYTES) {
      input.value = "";
      setError(VIDEO_TOO_LARGE);
      toast.error(VIDEO_TOO_LARGE);
      return;
    }
    setCompressing(isVideo);
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("slot", slot);
    data.set("file", file);
    startTransition(async () => {
      const result = await uploadSiteImageAction(data).finally(() => setCompressing(false));
      input.value = "";
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(`${label} güncellendi`);
      router.refresh();
    });
  }

  function onRemove() {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const result = await removeSiteImageAction({ eventId, slot });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(`${label} kaldırıldı`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">{label}</p>
      {path && previewIsVideo ? (
        <video
          src={`/api/uploads/${path}`}
          aria-label={label}
          className="h-32 w-full rounded border object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${path}`} alt={label} className="h-32 w-full rounded border object-cover" />
      ) : (
        <p className="text-sm text-muted-foreground">Görsel yok</p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={inputId} className="sr-only">
            {label} yükle
          </Label>
          <Input
            id={inputId}
            type="file"
            accept={acceptsVideo ? HERO_ACCEPT : IMAGE_ACCEPT}
            aria-label={`${label} yükle`}
            aria-describedby={helpId}
            onChange={onFileChange}
            disabled={pending}
          />
          {path ? (
            <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={pending}>
              Kaldır
            </Button>
          ) : null}
          <p id={helpId} className="w-full text-xs text-muted-foreground">
            {acceptsVideo ? HERO_HELP : IMAGE_HELP}
          </p>
          {pending && compressing ? (
            <p role="status" className="w-full text-xs text-muted-foreground">
              Video sıkıştırılıyor…
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
