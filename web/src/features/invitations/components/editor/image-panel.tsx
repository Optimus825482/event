"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeInvitationImageAction, uploadInvitationImageAction } from "../../actions";

type Props = {
  eventId: string;
  images: string[];
  imageSrc: (uploadPath: string) => string;
  onChange: (images: string[]) => void;
  onRemoved: (path: string) => void;
};

/** Etkinlik davetiyesine görsel yükler/kaldırır. Yükleme anında kaydedilir (tasarımdan bağımsız). */
export function ImagePanel({ eventId, images, imageSrc, onChange, onRemoved }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("eventId", eventId);
    form.set("file", file);
    const res = await uploadInvitationImageAction(form);
    setPending(false);
    if (input.current) input.current.value = "";
    if (!res.ok) return setError(res.message);
    onChange([...images, res.data.path]);
  }

  async function remove(path: string) {
    setPending(true);
    setError(null);
    const res = await removeInvitationImageAction({ eventId, path });
    setPending(false);
    if (!res.ok) return setError(res.message);
    onChange(images.filter((p) => p !== path));
    onRemoved(path);
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Görsel yükle"
        disabled={pending}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {images.length === 0 ? <p className="text-sm text-muted-foreground">Henüz görsel yok. JPG, PNG veya WebP, en çok 5 MB.</p> : null}
      <ul className="grid grid-cols-3 gap-2">
        {images.map((path, index) => (
          <li key={path} className="space-y-1">
            <Image src={imageSrc(path)} alt={`Yüklenen görsel ${index + 1}`} width={96} height={96} unoptimized className="aspect-square w-full rounded-md border border-border object-cover" />
            <Button type="button" size="sm" variant="ghost" className="w-full" disabled={pending} onClick={() => void remove(path)}>
              Kaldır
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
