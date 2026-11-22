"use client";

import { useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteUserAction } from "../actions";
import type { UserSummary } from "../types";

type Props = {
  /** Silinecek kullanıcı; `null` iken pencere kapalıdır. */
  user: UserSummary | null;
  onClose: () => void;
  /** Silme başarılı olduğunda, gösterilen mesajla birlikte çağrılır. */
  onDeleted: (message: string) => void;
};

/** Kullanıcı silme onay penceresi; liste ve ayrıntı sayfasında ortaktır. */
export function DeleteUserDialog({ user, onClose, onDeleted }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function remove(target: UserSummary) {
    startTransition(async () => {
      const result = await deleteUserAction({ id: target.id });
      onClose();
      if (result.ok) {
        const message =
          result.data.mode === "deleted"
            ? "Kullanıcı silindi"
            : "Kullanıcı geçmiş kayıtlarda anıldığı için anonimleştirildi ve kapatıldı";
        toast.success(message);
        onDeleted(message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Kullanıcı silinsin mi?"
      description={
        user
          ? `${user.username} hesabı silinecek ve tüm oturumları kapatılacak. Etkinlik sahibi ya da değerlendiren olarak anılıyorsa kayıt bozulmasın diye hesap anonimleştirilip kalıcı olarak kapatılır. Bu işlem geri alınamaz.`
          : ""
      }
      confirmText="Sil"
      variant="destructive"
      loading={pending}
      onConfirm={() => {
        if (user) remove(user);
      }}
    />
  );
}
