"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action";
import { createTableTypeAction, deleteTableTypeAction, updateTableTypeAction } from "../actions";
import { MAX_TABLE_CAPACITY, TABLE_SHAPES } from "../schemas";

export type TableTypeRowView = {
  id: string;
  name: string;
  color: string;
  shape: string;
  capacity: number;
  basePrice: string;
  currency: string;
  minSpacing: number;
  isActive: boolean;
  usageCount: number;
};

type Props = { tableTypes: TableTypeRowView[]; canCreate: boolean; canEdit: boolean; canDelete: boolean };

const SHAPE_LABELS: Record<(typeof TABLE_SHAPES)[number], string> = {
  round: "Yuvarlak",
  rectangle: "Dikdörtgen",
  square: "Kare",
};

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Errors({ messages }: { messages: string[] | undefined }) {
  return messages?.map((m) => (
    <p key={m} role="alert" className="text-sm text-destructive">
      {m}
    </p>
  ));
}

export function TableTypeManager({ tableTypes, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const ids = useId();
  const [editing, setEditing] = useState<TableTypeRowView | "new" | null>(null);
  const [deleting, setDeleting] = useState<TableTypeRowView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function run(task: () => Promise<ActionResult<unknown>>, after: () => void) {
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
      after();
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = {
      name: form.get("name"),
      color: form.get("color"),
      shape: form.get("shape"),
      capacity: form.get("capacity"),
      basePrice: form.get("basePrice"),
      minSpacing: form.get("minSpacing"),
      isActive: form.get("isActive") === "on",
    };
    const target = editing;
    void run(
      () => (target && target !== "new" ? updateTableTypeAction({ id: target.id, ...values }) : createTableTypeAction(values)),
      () => setEditing(null),
    );
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      {canCreate ? (
        <Button onClick={() => setEditing("new")} disabled={pending}>
          Yeni masa tipi
        </Button>
      ) : null}
      {error && editing === null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {tableTypes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Henüz masa tipi yok.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Şekil</TableHead>
              <TableHead className="text-right">Kapasite</TableHead>
              <TableHead className="text-right">Taban fiyat</TableHead>
              <TableHead className="text-right">Kullanım</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableTypes.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    {t.name}
                  </span>
                </TableCell>
                <TableCell>{SHAPE_LABELS[t.shape as keyof typeof SHAPE_LABELS] ?? t.shape}</TableCell>
                <TableCell className="text-right">{t.capacity}</TableCell>
                <TableCell className="text-right">
                  {Number(t.basePrice).toLocaleString("tr-TR", { style: "currency", currency: t.currency })}
                </TableCell>
                <TableCell className="text-right">{t.usageCount} masa</TableCell>
                <TableCell>
                  <Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "Aktif" : "Pasif"}</Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {canEdit ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(t)}>
                      Düzenle
                    </Button>
                  ) : null}
                  {canDelete && t.usageCount === 0 ? (
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => setDeleting(t)}>
                      Sil
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current ? "Masa tipini düzenle" : "Yeni masa tipi"}</DialogTitle>
          </DialogHeader>
          <form key={current?.id ?? "new"} className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${ids}-name`}>Ad</Label>
              <input id={`${ids}-name`} name="name" defaultValue={current?.name} required maxLength={60} className={fieldClass} />
              <Errors messages={fieldErrors.name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-shape`}>Şekil</Label>
              <select id={`${ids}-shape`} name="shape" defaultValue={current?.shape ?? "round"} className={fieldClass}>
                {TABLE_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </option>
                ))}
              </select>
              <Errors messages={fieldErrors.shape} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-color`}>Renk</Label>
              <input id={`${ids}-color`} name="color" type="color" defaultValue={current?.color ?? "#3b82f6"} className="h-9 w-20 rounded border border-input" />
              <Errors messages={fieldErrors.color} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-capacity`}>Kapasite</Label>
              <input id={`${ids}-capacity`} name="capacity" type="number" min={1} max={MAX_TABLE_CAPACITY} required defaultValue={current?.capacity ?? 8} className={fieldClass} />
              <Errors messages={fieldErrors.capacity} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-price`}>Taban fiyat</Label>
              <input id={`${ids}-price`} name="basePrice" type="number" min={0} step="0.01" required defaultValue={current ? Number(current.basePrice) : 0} className={fieldClass} />
              <Errors messages={fieldErrors.basePrice} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-spacing`}>Asgari aralık (px)</Label>
              <input id={`${ids}-spacing`} name="minSpacing" type="number" min={0} max={1000} defaultValue={current?.minSpacing ?? 50} className={fieldClass} />
              <Errors messages={fieldErrors.minSpacing} />
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} /> Aktif
            </label>
            {error ? (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending}>
                Kaydet
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title="Masa tipi silinsin mi?"
        description="Kullanımdaki tipler silinemez; bunun yerine pasife alın."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={() => {
          const target = deleting;
          if (target) void run(() => deleteTableTypeAction({ id: target.id }), () => setDeleting(null));
        }}
      />
    </div>
  );
}
