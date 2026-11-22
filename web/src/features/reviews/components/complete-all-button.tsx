"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { completeAllReviewsAction } from "../actions";

/** Tam puanlı tüm taslakları tek seferde tamamlar (eksik puanlılara dokunmaz). */
export function CompleteAllButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const res = await completeAllReviewsAction({ eventId });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      const { completed, incomplete } = res.data;
      setMessage({
        kind: "ok",
        text:
          incomplete > 0
            ? `${completed} değerlendirme tamamlandı; ${incomplete} taslakta eksik puan var.`
            : `${completed} değerlendirme tamamlandı.`,
      });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Beklenmeyen bir hata oluştu" });
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        Tüm taslakları tamamla
      </Button>
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600"}>
          {message.text}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Tüm taslakları tamamla"
        description="Tüm kategorileri puanlanmış taslaklar tamamlanır ve kilitlenir. Eksik puanlı taslaklar olduğu gibi kalır."
        confirmText="Tamamla"
        loading={pending}
        onConfirm={() => void run()}
      />
    </div>
  );
}
