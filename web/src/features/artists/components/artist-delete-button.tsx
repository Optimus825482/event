"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteArtistAction } from "../actions";

export function ArtistDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    try {
      const result = await deleteArtistAction({ id });
      if (result.ok) {
        toast.success("Sanatçı silindi");
        router.push("/artists");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Sil
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sanatçı silinsin mi?"
        description={`"${name}" kalıcı olarak silinir. Arşivde etkinliği olan sanatçı silinemez; pasife alın.`}
        confirmText="Sil"
        variant="destructive"
        loading={loading}
        onConfirm={() => void remove()}
      />
    </>
  );
}
