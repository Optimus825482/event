"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";
import { applyVenueTemplateAction, saveAsTemplateAction } from "../actions";
import type { ApplyTemplateResult } from "../service";

const LOCKED_TEMPLATE_HINT = "Satış başladıktan sonra şablon uygulanamaz";

export type TemplateOption = { id: string; name: string; tableCount: number; isPublic: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  templates: readonly TemplateOption[];
  canApply: boolean;
  /** Satış başladı: şablon uygulanamaz (sunucu da reddeder). */
  layoutLocked?: boolean;
  canSave: boolean;
  dirty: boolean;
  onApplied: (result: ApplyTemplateResult) => void;
  onMessage: (message: string) => void;
};

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TemplateDialog({ open, onOpenChange, eventId, templates, canApply, layoutLocked = false, canSave, dirty, onApplied, onMessage }: Props) {
  const ids = useId();
  const [selected, setSelected] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function run<T>(task: () => Promise<ActionResult<T>>, done: (data: T) => void) {
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
      done(res.data);
      onOpenChange(false);
    } catch {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  function onSaveTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(
      () =>
        saveAsTemplateAction({
          eventId,
          name: form.get("name"),
          description: form.get("description"),
          isPublic: form.get("isPublic") === "on",
        }),
      (data) => onMessage(`"${data.name}" şablonu kaydedildi`),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mekân şablonları</DialogTitle>
          <DialogDescription>
            Şablon uygulandığında rezervasyonu veya personel ataması olan masalar korunur, diğer masalar ve dekor
            şablondakilerle değiştirilir.
          </DialogDescription>
        </DialogHeader>

        {canApply ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Şablon uygula</h3>
            {templates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Kullanılabilir şablon yok.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <input
                        type="radio"
                        name={`${ids}-template`}
                        value={t.id}
                        checked={selected === t.id}
                        onChange={() => setSelected(t.id)}
                      />
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground">{t.tableCount} masa</span>
                      {t.isPublic ? <span className="ml-auto text-xs text-muted-foreground">Herkese açık</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {dirty ? (
              <p className="text-sm text-amber-600">Kaydedilmemiş değişiklikleriniz şablon uygulanınca kaybolur.</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending || selected === "" || layoutLocked}
              title={layoutLocked ? LOCKED_TEMPLATE_HINT : undefined}
              onClick={() =>
                void run(
                  () => applyVenueTemplateAction({ eventId, templateId: selected }),
                  (data) => {
                    onApplied(data);
                    const skipped = data.skippedLabels.length
                      ? ` Korunan masalarla çakıştığı için eklenmeyen: ${data.skippedLabels.join(", ")}.`
                      : "";
                    onMessage(`Şablon uygulandı.${skipped}`);
                  },
                )
              }
            >
              Uygula
            </Button>
            {layoutLocked ? <p className="text-sm text-muted-foreground">{LOCKED_TEMPLATE_HINT}</p> : null}
          </section>
        ) : null}

        {canSave ? (
          <form className="space-y-3 border-t border-border pt-4" onSubmit={onSaveTemplate}>
            <h3 className="text-sm font-medium">Kayıtlı yerleşimi şablon olarak sakla</h3>
            {dirty ? <p className="text-sm text-amber-600">Önce değişikliklerinizi kaydedin; şablona kayıtlı yerleşim yazılır.</p> : null}
            <div className="space-y-1">
              <Label htmlFor={`${ids}-name`}>Ad</Label>
              <input id={`${ids}-name`} name="name" required maxLength={120} className={fieldClass} />
              {fieldErrors.name?.map((m) => (
                <p key={m} role="alert" className="text-sm text-destructive">
                  {m}
                </p>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-description`}>Açıklama</Label>
              <textarea id={`${ids}-description`} name="description" maxLength={1000} rows={2} className={fieldClass} />
              {fieldErrors.description?.map((m) => (
                <p key={m} role="alert" className="text-sm text-destructive">
                  {m}
                </p>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublic" /> Herkese açık
            </label>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Şablon olarak kaydet
            </Button>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
