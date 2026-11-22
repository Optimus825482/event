"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteEventAction } from "../actions";
import { EventForm, type EventFormValues } from "./event-form";

const dialogClass = "max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-800 sm:max-w-lg";

/** "Yeni Etkinlik" düğmesi: eski arayüzdeki gibi iletişim kutusunda hızlı oluşturma. */
export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600"
      >
        <Plus className="h-5 w-5" aria-hidden />
        Yeni Etkinlik
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className="text-white">Yeni Etkinlik</DialogTitle>
            <DialogDescription className="text-slate-400">
              Temel bilgileri girin; alan düzeni ve ekibi sonra ekleyebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <EventForm
            idPrefix="create-"
            onCancel={() => setOpen(false)}
            onSaved={(id) => {
              setOpen(false);
              router.push(`/events/${id}`);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type RowProps = {
  event: EventFormValues;
  canEdit: boolean;
  canDelete: boolean;
  /** Silinebilir mi (taslak ve rezervasyonsuz)? Son söz sunucudadır. */
  deletable: boolean;
  /** Tamamlanmış/iptal edilmiş etkinlik düzenlenemez. */
  editable: boolean;
};

/** Satır eylemleri: düzenleme iletişim kutusu ve silme onayı. */
export function EventRowActions({ event, canEdit, canDelete, deletable, editable }: RowProps) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await deleteEventAction({ id: event.id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Etkinlik silindi");
      router.refresh();
    } catch {
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex justify-center gap-2">
      {canEdit && editable ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${event.name} etkinliğini düzenle`}
          className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      {canDelete && deletable ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${event.name} etkinliğini sil`}
          className="h-9 w-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className="text-white">Etkinliği Düzenle</DialogTitle>
            <DialogDescription className="text-slate-400">{event.name}</DialogDescription>
          </DialogHeader>
          <EventForm
            event={event}
            idPrefix={`edit-${event.id}-`}
            onCancel={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Etkinlik silinsin mi?"
        description={`"${event.name}" silinecek. Bu işlem geri alınamaz.`}
        confirmText="Sil"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
