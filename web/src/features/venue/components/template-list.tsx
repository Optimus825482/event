"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";
import { deleteVenueTemplateAction, duplicateVenueTemplateAction, updateVenueTemplateAction } from "../actions";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  usageCount: number;
  tableCount: number;
  capacity: number;
  createdByName: string | null;
  canManage: boolean;
};

type Props = { templates: TemplateRow[]; canEdit: boolean; canDelete: boolean; canCreate: boolean };

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TemplateList({ templates, canEdit, canDelete, canCreate }: Props) {
  const router = useRouter();
  const ids = useId();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function run(task: () => Promise<ActionResult<unknown>>, after?: () => void) {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await task();
      if (!res.ok) {
        setError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      after?.();
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const id = editing.id;
    void run(
      () =>
        updateVenueTemplateAction({
          id,
          name: form.get("name"),
          description: form.get("description"),
          isPublic: form.get("isPublic") === "on",
        }),
      () => setEditing(null),
    );
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Henüz şablon yok. Bir etkinliğin masa yerleşiminde &quot;Şablonlar&quot; menüsünden yerleşimi şablon olarak
        kaydedebilirsiniz.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && !editing ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <li key={t.id} className="space-y-2 rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{t.name}</h2>
              <Badge variant={t.isPublic ? "default" : "secondary"}>{t.isPublic ? "Herkese açık" : "Özel"}</Badge>
            </div>
            {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
            <p className="text-sm">
              {t.tableCount} masa · {t.capacity} kişi · {t.usageCount} kez kullanıldı
            </p>
            {t.createdByName ? <p className="text-xs text-muted-foreground">Oluşturan: {t.createdByName}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {canCreate ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => duplicateVenueTemplateAction({ id: t.id }))}>
                  Kopyala
                </Button>
              ) : null}
              {canEdit && t.canManage ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(t)}>
                  Düzenle
                </Button>
              ) : null}
              {canDelete && t.canManage ? (
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => setDeleting(t)}>
                  Sil
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şablonu düzenle</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} className="space-y-3" onSubmit={onSubmit}>
              <div className="space-y-1">
                <Label htmlFor={`${ids}-name`}>Ad</Label>
                <input id={`${ids}-name`} name="name" defaultValue={editing.name} required maxLength={120} className={fieldClass} />
                {fieldErrors.name?.map((m) => (
                  <p key={m} role="alert" className="text-sm text-destructive">
                    {m}
                  </p>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${ids}-description`}>Açıklama</Label>
                <textarea
                  id={`${ids}-description`}
                  name="description"
                  defaultValue={editing.description ?? ""}
                  maxLength={1000}
                  rows={3}
                  className={fieldClass}
                />
                {fieldErrors.description?.map((m) => (
                  <p key={m} role="alert" className="text-sm text-destructive">
                    {m}
                  </p>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isPublic" defaultChecked={editing.isPublic} /> Herkese açık
              </label>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={pending}>
                  Kaydet
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title="Şablon silinsin mi?"
        description="Şablonu kullanan etkinliklerin masaları etkilenmez. Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={() => {
          const target = deleting;
          if (target) void run(() => deleteVenueTemplateAction({ id: target.id }), () => setDeleting(null));
        }}
      />
    </div>
  );
}
