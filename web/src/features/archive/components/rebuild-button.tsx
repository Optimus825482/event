"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { rebuildArchiveAction } from "../actions";

export function RebuildButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function rebuild() {
    setLoading(true);
    try {
      const result = await rebuildArchiveAction({ eventId });
      if (result.ok) {
        toast.success(`Arşiv yeniden oluşturuldu (sürüm ${result.data.revision})`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Arşivi yeniden oluştur
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Arşiv yeniden oluşturulsun mu?"
        description="Arşiv güncel kayıtlardan yeniden yazılır; önceki değerler geri getirilemez."
        confirmText="Yeniden oluştur"
        variant="warning"
        loading={loading}
        onConfirm={() => {
          void rebuild();
        }}
      />
    </>
  );
}
