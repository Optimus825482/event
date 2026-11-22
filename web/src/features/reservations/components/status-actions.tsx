"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ReservationStatus } from "@/domain/reservation-status";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { cancelReservationAction, changeReservationStatusAction } from "../actions";

type Props = {
  id: string;
  status: ReservationStatus;
  canEdit: boolean;
  /** Yalnızca yönetici kara listeyi aşabilir; son söz sunucudadır. */
  canOverrideBlacklist: boolean;
  isBlacklisted: boolean;
  compact?: boolean;
};

/** Satır/ayrıntı durum düğmeleri: onayla, iptal et, iptalden geri al. Check-in ve gelmedi burada yok. */
export function ReservationStatusActions({ id, status, canEdit, canOverrideBlacklist, isBlacklisted, compact }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!canEdit) return null;

  const size = compact ? "sm" : "default";
  const overrideBlacklist = isBlacklisted && canOverrideBlacklist;
  const confirm = () =>
    run(changeReservationStatusAction, { id, status: "confirmed", overrideBlacklist }, () => router.refresh());

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <Button size={size} variant="outline" disabled={pending} onClick={confirm}>
            Onayla
          </Button>
        ) : null}
        {status === "cancelled" ? (
          <Button size={size} variant="outline" disabled={pending} onClick={confirm}>
            {overrideBlacklist ? "Kara listeye rağmen yeniden onayla" : "Yeniden onayla"}
          </Button>
        ) : null}
        {status === "pending" || status === "confirmed" ? (
          <Button size={size} variant="destructive" disabled={pending} onClick={() => setConfirmCancel(true)}>
            İptal et
          </Button>
        ) : null}
      </div>
      {failure ? (
        <p role="alert" className="text-xs text-destructive">
          {failure.message}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Rezervasyon iptal edilsin mi?"
        description="Masa boşa çıkar. Masa başkasına verilmediyse rezervasyon sonra yeniden onaylanabilir."
        confirmText="İptal et"
        cancelText="Vazgeç"
        variant="destructive"
        loading={pending}
        onConfirm={() =>
          run(cancelReservationAction, { id }, () => {
            setConfirmCancel(false);
            router.refresh();
          })
        }
      />
    </div>
  );
}
