"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EVENT_STATUSES, canTransitionEvent, type EventStatus } from "@/domain/event-status";
import { changeEventStatusAction, deleteEventAction } from "../actions";
import { EVENT_STATUS_LABELS } from "../labels";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const targets = EVENT_STATUSES.filter((to) => canTransitionEvent(status, to));

  async function run(task: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setPending(true);
    setError(null);
    try {
      const res = await task();
      if (!res.ok) {
        setError(res.message ?? "İşlem başarısız");
        return;
      }
      if (after) after();
      else router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
      setConfirmDelete(false);
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
                onClick={() => run(() => changeEventStatusAction({ id, status: to }))}
              >
                {EVENT_STATUS_LABELS[to]} yap
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
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
