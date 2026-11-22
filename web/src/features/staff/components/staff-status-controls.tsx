"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { deleteStaff, setStaffStatus } from "../actions/staff";

type Status = "active" | "inactive" | "terminated";

export function StaffStatusControls({
  id,
  status,
  assignmentCount,
  canEdit,
  canDelete,
}: {
  id: string;
  status: Status;
  assignmentCount: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");

  function change(next: Status) {
    startTransition(async () => {
      const result = await setStaffStatus({
        id,
        status: next,
        terminationReason: next === "terminated" ? reason : null,
      });
      setMessage(result.ok ? null : result.message);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteStaff({ id });
      setConfirmDelete(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.push("/staff");
    });
  }

  return (
    <div className="space-y-3">
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {status !== "active" ? (
            <Button variant="outline" disabled={pending} onClick={() => change("active")}>
              Yeniden etkinleştir
            </Button>
          ) : (
            <Button variant="outline" disabled={pending} onClick={() => change("inactive")}>
              Pasifleştir
            </Button>
          )}
          {status !== "terminated" ? (
            <>
              <Input
                aria-label="Ayrılma nedeni"
                placeholder="Ayrılma nedeni"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-56"
              />
              <Button variant="outline" disabled={pending} onClick={() => change("terminated")}>
                Ayrıldı olarak işaretle
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {canDelete ? (
        <div>
          <Button
            variant="destructive"
            disabled={pending || assignmentCount > 0}
            onClick={() => setConfirmDelete(true)}
          >
            Sil
          </Button>
          {assignmentCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {assignmentCount} etkinlik ataması var; silmek yerine pasifleştirin.
            </p>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Personel silinsin mi?"
        description="Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={remove}
      />
    </div>
  );
}
