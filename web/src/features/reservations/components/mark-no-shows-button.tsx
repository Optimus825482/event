"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { markNoShowsAction } from "../actions";

/** Tamamlanmış etkinlikte bekleyen/onaylı rezervasyonları toplu "gelmedi" yapar. */
export function MarkNoShowsButton({ eventId, candidates }: { eventId: string; candidates: number }) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      <Button variant="outline" disabled={pending || candidates === 0} onClick={() => setOpen(true)}>
        Gelmeyenleri işaretle ({candidates})
      </Button>
      {done !== null ? (
        <p role="status" className="text-xs text-muted-foreground">
          {done} rezervasyon gelmedi olarak işaretlendi.
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-xs text-destructive">
          {failure.message}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Gelmeyenler işaretlensin mi?"
        description="Bekleyen ve onaylı tüm rezervasyonlar gelmedi olur; müşterilerin gelmedi sayısı artar."
        confirmText="İşaretle"
        cancelText="Vazgeç"
        variant="warning"
        loading={pending}
        onConfirm={() =>
          run(markNoShowsAction, { eventId }, (data) => {
            setOpen(false);
            setDone(data.updated);
            router.refresh();
          })
        }
      />
    </div>
  );
}
