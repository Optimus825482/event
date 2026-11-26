"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { createArtistAction, updateArtistAction } from "../actions";

export type EditableArtist = { id: string; name: string; genre: string | null; notes: string | null; isActive: boolean };

function FieldError({ messages }: { messages: string[] | undefined }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {messages.join(" ")}
    </p>
  );
}

const FIELD = "border-slate-500";

export function ArtistForm({ artist }: { artist?: EditableArtist }) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const errors = failure?.fieldErrors ?? {};
  const prefix = artist ? `artist-${artist.id}` : "artist-new";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "");
    if (artist) {
      run(
        updateArtistAction,
        { id: artist.id, name: text("name"), genre: text("genre"), notes: text("notes"), isActive: data.get("isActive") === "on" },
        () => router.refresh(),
        "Sanatçı güncellendi",
      );
      return;
    }
    run(
      createArtistAction,
      { name: text("name"), genre: text("genre"), notes: text("notes") },
      () => {
        form.reset();
        router.refresh();
      },
      "Sanatçı eklendi",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-name`}>Ad</Label>
        <Input id={`${prefix}-name`} name="name" required maxLength={200} defaultValue={artist?.name ?? ""} className={FIELD} />
        <FieldError messages={errors.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-genre`}>Tür</Label>
        <Input id={`${prefix}-genre`} name="genre" maxLength={100} defaultValue={artist?.genre ?? ""} className={FIELD} />
        <FieldError messages={errors.genre} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${prefix}-notes`}>Not</Label>
        <Textarea id={`${prefix}-notes`} name="notes" maxLength={2000} defaultValue={artist?.notes ?? ""} className={FIELD} />
        <FieldError messages={errors.notes} />
      </div>
      {artist ? (
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id={`${prefix}-active`}
            type="checkbox"
            name="isActive"
            defaultChecked={artist.isActive}
            className="size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
          <Label htmlFor={`${prefix}-active`}>Etkin</Label>
        </div>
      ) : null}
      {failure && Object.keys(errors).length === 0 ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300 sm:col-span-2">
          {failure.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor..." : artist ? "Kaydet" : "Sanatçı ekle"}
        </Button>
      </div>
    </form>
  );
}
