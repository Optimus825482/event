"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EVENT_STATUSES, canTransitionEvent, type EventStatus } from "@/domain/event-status";
import { changeEventStatusAction, deleteEventAction } from "../actions";
import { EVENT_TRANSITION_ACTIONS, transitionConfirmation } from "../labels";

const STATUS_TOAST: Record<EventStatus, string> = {
  draft: "Etkinlik taslağa alındı",
  published: "Etkinlik yayınlandı",
  active: "Etkinlik başlatıldı",
  completed: "Etkinlik tamamlandı",
  cancelled: "Etkinlik iptal edildi",
};

type Props = {
  id: string;
  status: EventStatus;
  canEdit: boolean;
  canDelete: boolean;
  /** Silinebilir mi (taslak ve rezervasyonsuz)? Son söz sunucudadır. */
  deletable: boolean;
};

export function EventActions({ id, status, canEdit, canDelete, deletable }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<EventStatus | null>(null);
  const targets = EVENT_STATUSES.filter((to) => canTransitionEvent(status, to));

  async function run(
    task: () => Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
    after?: () => void,
  ) {
    setPending(true);
    setError(null);
    try {
      const res = await task();
      if (!res.ok) {
        setError(res.message ?? "İşlem başarısız");
        toast.error(res.message ?? "İşlem başarısız");
        return;
      }
      toast.success(successMessage);
      if (after) after();
      else router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu");
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
      setConfirmDelete(false);
      setConfirmStatus(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canEdit
          ? targets.map((to) => (
              <Button
                key={to}
                variant={to === "cancelled" ? "destructive" : "outline"}
                size="sm"
                disabled={pending}
                onClick={() =>
                  transitionConfirmation(to) ? setConfirmStatus(to) : void run(() => changeEventStatusAction({ id, status: to }), STATUS_TOAST[to])
                }
              >
                {EVENT_TRANSITION_ACTIONS[to].label}
              </Button>
            ))
          : null}
        {canDelete && deletable ? (
          <Button variant="destructive" size="sm" disabled={pending} onClick={() => setConfirmDelete(true)}>
            Sil
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {confirmStatus ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmStatus(null);
          }}
          title={transitionConfirmation(confirmStatus)?.title ?? ""}
          description={transitionConfirmation(confirmStatus)?.description ?? ""}
          confirmText={EVENT_TRANSITION_ACTIONS[confirmStatus].label}
          variant={confirmStatus === "cancelled" ? "destructive" : "warning"}
          loading={pending}
          onConfirm={() => void run(() => changeEventStatusAction({ id, status: confirmStatus }), STATUS_TOAST[confirmStatus])}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Etkinlik silinsin mi?"
        description="Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={() =>
          void run(
            () => deleteEventAction({ id }),
            "Etkinlik silindi",
            () => {
              router.push("/events");
              router.refresh();
            },
          )
        }
      />
    </div>
  );
}
