"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { dateToZonedWallClock } from "@/lib/time-zone";
import { saveSaleSettingsAction } from "../actions";
import type { SaleSettings } from "../settings-service";
import { parseWholeNumber } from "../view-model";

type FieldName = "holdMinutes" | "maxSeatsPerOrder" | "saleStartsAt" | "saleEndsAt";
type Errors = Partial<Record<FieldName, string>>;

const wallClock = (date: Date | null) => (date ? dateToZonedWallClock(date) : "");

const SWITCHES = [
  { key: "sharedTables", label: "Paylaşımlı masa", hint: "Kapalıyken masa yalnızca bütün olarak satılır" },
  { key: "blockSingleLeftover", label: "Tek sandalye bırakan alımı engelle", hint: null },
  { key: "locaOnline", label: "Localar online satılsın", hint: null },
] as const;

/** Satış kuralları formu. Girdiler metindir; gönderirken sayıya çevrilir (sunucu şeması sayı bekler). */
export function SaleSettingsForm({
  eventId,
  settings,
  canEdit,
  onSaved,
}: {
  eventId: string;
  settings: SaleSettings;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState({
    sharedTables: settings.sharedTables,
    blockSingleLeftover: settings.blockSingleLeftover,
    locaOnline: settings.locaOnline,
  });
  const [holdMinutes, setHoldMinutes] = useState(String(settings.holdMinutes));
  const [maxSeatsPerOrder, setMaxSeatsPerOrder] = useState(String(settings.maxSeatsPerOrder));
  const [saleStartsAt, setSaleStartsAt] = useState(wallClock(settings.saleStartsAt));
  const [saleEndsAt, setSaleEndsAt] = useState(wallClock(settings.saleEndsAt));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const result = await saveSaleSettingsAction({
        eventId,
        ...flags,
        holdMinutes: parseWholeNumber(holdMinutes),
        maxSeatsPerOrder: parseWholeNumber(maxSeatsPerOrder),
        saleStartsAt: saleStartsAt === "" ? null : saleStartsAt,
        saleEndsAt: saleEndsAt === "" ? null : saleEndsAt,
      });
      if (result.ok) {
        setErrors({});
        setFormError(null);
        toast.success("Satış kuralları kaydedildi");
        onSaved();
        return;
      }
      const next: Errors = {};
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages[0]) next[field as FieldName] = messages[0];
      }
      setErrors(next);
      setFormError(result.message);
      toast.error(result.message);
    });
  }

  function field(name: FieldName, label: string, value: string, set: (v: string) => void, type: "number" | "datetime-local") {
    const id = `sale-${name}`;
    const error = errors[name];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value}
          readOnly={!canEdit}
          onChange={(e) => {
            set(e.target.value);
            setErrors((prev) => ({ ...prev, [name]: undefined }));
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11"
        />
        {error ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="sale-rules-heading"
      className="rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="sale-rules-heading" className="mb-4 text-lg font-semibold">
        Satış kuralları
      </h2>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <ul className="space-y-1">
          {SWITCHES.map(({ key, label, hint }) => {
            const id = `sale-${key}`;
            return (
              <li key={key} className="flex min-h-11 items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor={id} className="leading-snug">
                    {label}
                  </Label>
                  {hint ? (
                    <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted-foreground">
                      {hint}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="w-10 text-right text-sm text-muted-foreground" aria-hidden="true">
                    {flags[key] ? "Açık" : "Kapalı"}
                  </span>
                  <Switch
                    id={id}
                    checked={flags[key]}
                    disabled={!canEdit}
                    aria-describedby={hint ? `${id}-hint` : undefined}
                    onCheckedChange={(checked) => setFlags((prev) => ({ ...prev, [key]: checked }))}
                    className="data-[state=unchecked]:bg-muted-foreground"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("holdMinutes", "Tutma süresi (dk)", holdMinutes, setHoldMinutes, "number")}
          {field("maxSeatsPerOrder", "Sipariş başına azami adet", maxSeatsPerOrder, setMaxSeatsPerOrder, "number")}
          {field("saleStartsAt", "Satış başlangıcı", saleStartsAt, setSaleStartsAt, "datetime-local")}
          {field("saleEndsAt", "Satış bitişi", saleEndsAt, setSaleEndsAt, "datetime-local")}
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">Satış kurallarını yalnızca düzenleme yetkisi olanlar değiştirebilir.</p>
        ) : null}
        <Button type="submit" className="h-11" disabled={!canEdit || pending}>
          Kuralları kaydet
        </Button>
      </form>
    </section>
  );
}
