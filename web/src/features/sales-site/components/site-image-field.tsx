"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { removeSiteImageAction, uploadSiteImageAction } from "../actions";
import { IMAGE_SLOT_LABELS, type ImageSlot } from "../image-status";

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

  const label = `${IMAGE_SLOT_LABELS[slot]} görseli`;
  const inputId = `site-image-${slot}`;

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !canEdit) return;
    setError(null);
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("slot", slot);
    data.set("file", file);
    startTransition(async () => {
      const result = await uploadSiteImageAction(data);
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
      {path ? (
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
            accept="image/jpeg,image/png,image/webp"
            aria-label={`${label} yükle`}
            onChange={onFileChange}
            disabled={pending}
          />
          {path ? (
            <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={pending}>
              Kaldır
            </Button>
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
