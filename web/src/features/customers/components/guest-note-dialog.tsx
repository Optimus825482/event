"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SELECT_CLASS } from "@/features/users/components/field";
import { addNoteAction } from "../actions";
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType } from "../schemas";
import { useRunAction } from "./use-run-action";

/** "Yeni Not Ekle" penceresi (eski misafir sayfası): not türü ve metin; mevcut `addNote` eylemini kullanır. */
export function GuestNoteDialog({ customerId, guestName }: { customerId: string; guestName: string }) {
  const router = useRouter();
  const { pending, failure, run, clear } = useRunAction();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      addNoteAction,
      { customerId, content, noteType },
      () => {
        setContent("");
        setOpen(false);
        router.refresh();
      },
      "Not eklendi",
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) clear();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`${guestName} için yeni not ekle`}>
          <Plus />
          Yeni Not
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Yeni Not Ekle</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{guestName}</p>
          <div className="space-y-1.5">
            <Label htmlFor={`note-type-${customerId}`}>Not türü</Label>
            <select
              id={`note-type-${customerId}`}
              value={noteType}
              onChange={(e) => setNoteType(NOTE_TYPES.find((t) => t === e.target.value) ?? "general")}
              className={SELECT_CLASS}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {NOTE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`note-content-${customerId}`}>Not</Label>
            <Textarea
              id={`note-content-${customerId}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Misafir hakkında not yazın"
            />
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure.fieldErrors.content?.join(" ") ?? failure.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ekleniyor…" : "Not ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
