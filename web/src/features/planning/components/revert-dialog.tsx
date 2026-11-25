"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_NOTE = 500;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (note: string) => void;
};

/** Aşamayı geri alma: gerekçe zorunlu (en fazla 500 karakter). */
export function RevertDialog({ open, onOpenChange, pending, onSubmit }: Props) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const invalid = trimmed.length === 0 || trimmed.length > MAX_NOTE;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid && !pending) onSubmit(trimmed);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Aşamayı geri al</DialogTitle>
            <DialogDescription>Geri alma nedeni ilgili ekiplerle paylaşılır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revert-note">Neden</Label>
            <Textarea
              id="revert-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE}
              required
              rows={4}
            />
            <p className="text-right text-xs text-slate-400">
              {trimmed.length}/{MAX_NOTE}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Vazgeç
            </Button>
            <Button type="submit" variant="destructive" disabled={invalid || pending}>
              {pending ? "İşleniyor..." : "Geri al"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
