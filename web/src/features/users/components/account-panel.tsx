"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setUserActiveAction } from "../actions";
import { ResetPasswordForm } from "./reset-password-form";

type Props = { userId: string; isActive: boolean; isSelf: boolean };

/** Pasifleştirme/etkinleştirme ve parola sıfırlama. */
export function AccountPanel({ userId, isActive, isSelf }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function apply(next: boolean) {
    startTransition(async () => {
      const result = await setUserActiveAction({ id: userId, active: next });
      setConfirming(false);
      if (result.ok) {
        toast.success(next ? "Kullanıcı etkinleştirildi" : "Kullanıcı pasifleştirildi");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={isActive ? "destructive" : "default"}
          disabled={pending || (isSelf && isActive)}
          onClick={() => (isActive ? setConfirming(true) : apply(true))}
        >
          {isActive ? "Pasifleştir" : "Etkinleştir"}
        </Button>
        {isSelf && isActive ? (
          <span className="text-xs text-muted-foreground">Kendi hesabınızı pasifleştiremezsiniz</span>
        ) : null}
      </div>
      <ResetPasswordForm userId={userId} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Kullanıcı pasifleştirilsin mi?"
        description="Kullanıcı pasifleştirilecek ve tüm oturumları kapatılacak."
        confirmText="Pasifleştir"
        variant="destructive"
        loading={pending}
        onConfirm={() => apply(false)}
      />
    </div>
  );
}
