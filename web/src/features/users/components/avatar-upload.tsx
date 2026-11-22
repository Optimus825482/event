"use client";

import { Camera, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setOwnAvatarAction } from "../actions";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  AVATAR_SIZE,
  AVATAR_SOURCE_MAX_BYTES,
  centerSquare,
  checkAvatarDataUrl,
} from "../avatar";

const QUALITIES = [0.85, 0.7, 0.5] as const;

/** Görseli ortadan kare kırpıp `AVATAR_SIZE` piksele indirger; WebP desteklenmezse JPEG kullanılır. */
async function resizeToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    const { sx, sy, size } = centerSquare(bitmap.width, bitmap.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const quality of QUALITIES) {
      let url = canvas.toDataURL("image/webp", quality);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
      if (checkAvatarDataUrl(url).ok) return url;
    }
    throw new Error("size");
  } finally {
    bitmap.close();
  }
}

type Props = { image: string | null; name: string };

/** Profil fotoğrafı seçme/kaldırma. Görsel tarayıcıda küçültülür; sunucu biçimi ve boyutu yeniden denetler. */
export function AvatarUpload({ image, name }: Props) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string | null) {
    startTransition(async () => {
      const result = await setOwnAvatarAction({ image: next });
      if (result.ok) {
        setError(null);
        toast.success(next ? "Profil fotoğrafı güncellendi" : "Profil fotoğrafı kaldırıldı");
        router.refresh();
      } else {
        setError(result.fieldErrors?.image?.[0] ?? result.message);
      }
    });
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Yalnızca JPEG, PNG veya WebP görsel seçebilirsiniz");
      return;
    }
    if (file.size > AVATAR_SOURCE_MAX_BYTES) {
      setError(`Dosya en fazla ${AVATAR_SOURCE_MAX_BYTES / (1024 * 1024)} MB olabilir`);
      return;
    }
    try {
      save(await resizeToDataUrl(file));
    } catch {
      setError(`Görsel işlenemedi; ${AVATAR_MAX_BYTES / 1024} KB altına indirilemedi ya da dosya bozuk`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20 border border-slate-600">
        {image ? <AvatarImage src={image} alt={`${name} profil fotoğrafı`} /> : null}
        <AvatarFallback className="bg-slate-700">
          <User aria-hidden="true" className="size-8 text-slate-300" />
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            tabIndex={-1}
            aria-hidden="true"
            type="file"
            accept={AVATAR_MIME_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => void onPick(event)}
            disabled={pending}
          />
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Camera aria-hidden="true" className="size-4" />
            {image ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          </Button>
          {image ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => save(null)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Fotoğrafı kaldır
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-400">
          JPEG, PNG veya WebP. Görsel {AVATAR_SIZE}×{AVATAR_SIZE} piksel kareye küçültülür.
        </p>
        <p role="alert" className={error ? "text-xs text-red-400" : "sr-only"}>
          {error}
        </p>
      </div>
    </div>
  );
}
