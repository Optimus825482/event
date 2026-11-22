"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addTagAction, removeTagAction } from "../actions";
import { tagStyle } from "../vip";
import { useRunAction } from "./use-run-action";

type Props = { customerId: string; tags: string[]; canEdit: boolean };

export function TagsEditor({ customerId, tags, canEdit }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [draft, setDraft] = useState("");

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim() === "") return;
    run(
      addTagAction,
      { customerId, tag: draft },
      () => {
        setDraft("");
        router.refresh();
      },
      "Etiket eklendi",
    );
  }

  const tagErrors = failure?.fieldErrors.tag;

  return (
    <div className="space-y-3">
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">Etiket yok.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium", tagStyle(tag).className)}>
                {tag}
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`${tag} etiketini kaldır`}
                    disabled={pending}
                    className="ml-1 rounded-sm px-1 hover:bg-background/60"
                    onClick={() => run(removeTagAction, { customerId, tag }, () => router.refresh(), "Etiket kaldırıldı")}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Yeni etiket"
            aria-label="Yeni etiket"
            maxLength={50}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Ekle
          </Button>
        </form>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {tagErrors ? tagErrors.join(" ") : failure.message}
        </p>
      ) : null}
    </div>
  );
}
