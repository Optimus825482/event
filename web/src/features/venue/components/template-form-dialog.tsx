"use client";

import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type TemplateFormValues = { name: string; description: string; isPublic: boolean };

type Props = {
  open: boolean;
  title: string;
  description?: string;
  initial?: Partial<TemplateFormValues>;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TemplateFormValues) => void;
};

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Hem "Yeni şablon" (boş) hem "Şablonu düzenle" için ortak ad/açıklama/görünürlük formu. */
export function TemplateFormDialog({
  open,
  title,
  description,
  initial,
  submitLabel,
  pending,
  error,
  fieldErrors,
  onOpenChange,
  onSubmit,
}: Props) {
  const ids = useId();

  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      isPublic: form.get("isPublic") === "on",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open ? (
          <form className="space-y-3" onSubmit={handle}>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-name`}>Şablon adı</Label>
              <input
                id={`${ids}-name`}
                name="name"
                defaultValue={initial?.name ?? ""}
                placeholder="Örn: Düğün Salonu A"
                required
                maxLength={120}
                className={fieldClass}
              />
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
                defaultValue={initial?.description ?? ""}
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
              <input type="checkbox" name="isPublic" defaultChecked={initial?.isPublic ?? false} /> Herkese açık
            </label>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending}>
                {submitLabel}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
