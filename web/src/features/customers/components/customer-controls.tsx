"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCustomerAction, setBlacklistAction } from "../actions";
import { useRunAction } from "./use-run-action";

type Props = { customerId: string; isBlacklisted: boolean; canEdit: boolean; canDelete: boolean };

/** Kara liste ve silme düğmeleri (onaylı). */
export function CustomerControls({ customerId, isBlacklisted, canEdit, canDelete }: Props) {
  const router = useRouter();
  const { pending, failure, run, clear } = useRunAction();
  const [confirm, setConfirm] = useState<"blacklist" | "delete" | null>(null);

  function close(open: boolean) {
    if (!open) {
      setConfirm(null);
      clear();
    }
  }

  function onConfirm() {
    if (confirm === "blacklist") {
      run(
        setBlacklistAction,
        { id: customerId, isBlacklisted: !isBlacklisted },
        () => {
          setConfirm(null);
          router.refresh();
        },
        isBlacklisted ? "Müşteri kara listeden çıkarıldı" : "Müşteri kara listeye alındı",
      );
    } else if (confirm === "delete") {
      run(deleteCustomerAction, { id: customerId }, () => router.push("/customers"), "Müşteri silindi");
    }
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button type="button" variant="outline" onClick={() => setConfirm("blacklist")}>
            {isBlacklisted ? "Kara listeden çıkar" : "Kara listeye al"}
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="destructive" onClick={() => setConfirm("delete")}>
            Müşteriyi sil
          </Button>
        ) : null}
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={close}
        variant={confirm === "delete" ? "destructive" : "warning"}
        title={confirm === "delete" ? "Müşteri silinsin mi?" : isBlacklisted ? "Kara listeden çıkarılsın mı?" : "Kara listeye alınsın mı?"}
        description={
          confirm === "delete"
            ? "Müşteri, etiketleri ve notları kalıcı olarak silinir. Rezervasyonu olan müşteri silinemez."
            : isBlacklisted
              ? "Müşteri yeniden rezervasyon alabilir."
              : "Kara listedeki müşteri için yeni rezervasyon yalnızca yönetici onayıyla oluşturulabilir."
        }
        confirmText={confirm === "delete" ? "Sil" : "Onayla"}
        cancelText="Vazgeç"
        loading={pending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
