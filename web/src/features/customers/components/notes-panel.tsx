"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "../actions";
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType } from "../schemas";
import { useRunAction } from "./use-run-action";

// Sunucu (UTC) ve tarayıcı aynı metni üretsin: saat dilimi sabit.
const NOTE_TIME = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export type NoteView = {
  id: string;
  content: string;
  noteType: NoteType;
  createdAt: string;
  eventName: string | null;
  createdByName: string | null;
};

type Props = { customerId: string; notes: NoteView[]; canEdit: boolean };

function NoteItem({ note, canEdit }: { note: NoteView; canEdit: boolean }) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      updateNoteAction,
      { id: note.id, content: draft },
      () => {
        setEditing(false);
        router.refresh();
      },
      "Not güncellendi",
    );
  }

  return (
    <li className="space-y-2 rounded-(--radius) border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{NOTE_TYPE_LABELS[note.noteType]}</Badge>
        {note.eventName ? <span>{note.eventName}</span> : null}
        <span>{NOTE_TIME.format(new Date(note.createdAt))}</span>
        {note.createdByName ? <span>{note.createdByName}</span> : null}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Not metni" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Kaydet
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{note.content}</p>
      )}
      {canEdit && !editing ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Düzenle
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(deleteNoteAction, { id: note.id }, () => router.refresh(), "Not silindi")}
          >
            Sil
          </Button>
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.fieldErrors.content?.join(" ") ?? failure.message}
        </p>
      ) : null}
    </li>
  );
}

export function NotesPanel({ customerId, notes, canEdit }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      addNoteAction,
      { customerId, content, noteType },
      () => {
        setContent("");
        router.refresh();
      },
      "Not eklendi",
    );
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <form onSubmit={add} className="space-y-2">
          <div className="flex flex-wrap gap-3 text-sm">
            {NOTE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="noteType"
                  value={type}
                  checked={noteType === type}
                  onChange={() => setNoteType(type)}
                />
                {NOTE_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Misafir hakkında not yazın"
            aria-label="Yeni not"
          />
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure.fieldErrors.content?.join(" ") ?? failure.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Ekleniyor…" : "Not ekle"}
          </Button>
        </form>
      ) : null}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz not yok.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}
