"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDraftStamp } from "../editor/draft";

/** "Kaydedilmemiş Taslak Bulundu" penceresi (eski düzenleyicideki gibi). */
export function DraftRecoveryDialog({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    // Esc / dış tıklama taslağı silmesin: karar yalnızca iki düğmeyle verilir.
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Kaydedilmemiş Taslak Bulundu</DialogTitle>
          <DialogDescription>Bu etkinlik için kaydedilmemiş bir taslak bulundu.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{`Son kayıt: ${formatDraftStamp(savedAt)}`}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDiscard}>
            Taslağı Sil
          </Button>
          <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onRestore}>
            Taslağı Yükle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
