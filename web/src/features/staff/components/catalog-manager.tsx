"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action";
import { Field, textOrNull, type FieldErrors } from "./field";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "color" | "number" | "time";
  required?: boolean;
  /** Güncellemede değiştirilemeyen alan (ör. rol anahtarı). */
  createOnly?: boolean;
};

export type CatalogRow = { id: string; isActive: boolean } & Record<string, unknown>;

type Action = (raw: unknown) => Promise<ActionResult<unknown>>;

type Props = {
  noun: string;
  items: CatalogRow[];
  fields: FieldDef[];
  columns: { name: string; label: string }[];
  create: Action;
  update: Action;
  remove: Action;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

function readValues(fd: FormData, fields: FieldDef[], isActive: boolean) {
  const values: Record<string, unknown> = { isActive };
  for (const f of fields) {
    const raw = textOrNull(fd, f.name);
    values[f.name] = f.type === "number" ? (raw === null ? 0 : Number(raw)) : f.required ? (raw ?? "") : raw;
  }
  return values;
}

export function CatalogManager(props: Props) {
  const { noun, items, fields, columns, canCreate, canEdit, canDelete } = props;
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<CatalogRow | "new" | null>(null);
  const [errors, setErrors] = useState<FieldErrors>();
  const [message, setMessage] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CatalogRow | null>(null);
  const [pending, startTransition] = useTransition();

  function open(target: CatalogRow | "new" | null) {
    setEditing(target);
    setErrors(undefined);
    setMessage(null);
  }

  function submit(fd: FormData) {
    const current = editing;
    if (!current) return;
    const isActive = fd.get("isActive") === "on";
    const values = readValues(fd, fields, isActive);
    startTransition(async () => {
      const result =
        current === "new"
          ? await props.create(values)
          : await props.update({ id: current.id, ...values });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(current === "new" ? `${noun} eklendi` : `${noun} güncellendi`);
      open(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    const target = toDelete;
    if (!target) return;
    startTransition(async () => {
      const result = await props.remove({ id: target.id });
      setToDelete(null);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(`${noun} silindi`);
      setMessage(null);
      router.refresh();
    });
  }

  const editingRow = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} kayıt</p>
        {canCreate ? <Button onClick={() => open("new")}>{noun} ekle</Button> : null}
      </div>

      {!editing && message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {editing ? (
        <form action={submit} className="space-y-4 rounded-md border border-border p-4">
          <h3 className="font-medium">{editing === "new" ? `Yeni ${noun.toLowerCase()}` : `${noun} düzenle`}</h3>
          {message ? (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields
              .filter((f) => !(f.createOnly && editing !== "new"))
              .map((f) => {
                const current = editingRow?.[f.name];
                const defaultValue =
                  typeof current === "string" || typeof current === "number"
                    ? String(current).slice(0, f.type === "time" ? 5 : undefined)
                    : f.type === "color"
                      ? "#3b82f6"
                      : "";
                return (
                  <Field key={f.name} label={f.label} name={f.name} errors={errors}>
                    <Input
                      id={f.name}
                      name={f.name}
                      type={f.type}
                      defaultValue={defaultValue}
                      required={f.required}
                      className={f.type === "color" ? "h-9 p-1" : undefined}
                    />
                  </Field>
                );
              })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editingRow?.isActive ?? true} />
            Etkin
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button type="button" variant="outline" onClick={() => open(null)}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Henüz kayıt yok.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.name}>{c.label}</TableHead>
              ))}
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {columns.map((c) => (
                  <TableCell key={c.name}>{String(item[c.name] ?? "—")}</TableCell>
                ))}
                <TableCell>{item.isActive ? "Etkin" : "Pasif"}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {canEdit ? (
                    <Button size="sm" variant="outline" onClick={() => open(item)}>
                      Düzenle
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="destructive" onClick={() => setToDelete(item)}>
                      Sil
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title={`${noun} silinsin mi?`}
        description="Kullanımda olan kayıtlar silinemez; bunun yerine pasifleştirin."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
