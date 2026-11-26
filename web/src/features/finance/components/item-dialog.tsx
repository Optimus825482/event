"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createFinanceItemAction, updateFinanceItemAction } from "../actions";
import {
  CATEGORIES_BY_DIRECTION,
  FINANCE_CATEGORY_LABELS,
  FINANCE_DIRECTION_LABELS,
  FINANCE_DIRECTIONS,
  type FinanceDirection,
} from "../constants";
import type { FinanceOverview } from "../overview";
import { itemFormToInput, type ItemForm } from "../view-model";
import { firstFieldErrors, useFinanceAction } from "./use-finance-action";

export type FinanceItem = FinanceOverview["items"][number];

type Errors = Partial<Record<"label" | "category" | "estimated" | "actual" | "note", string>>;

const SERVER_FIELDS: Record<string, keyof Errors> = {
  label: "label",
  category: "category",
  estimatedAmount: "estimated",
  actualAmount: "actual",
  note: "note",
};

function amountText(amount: string | null): string {
  return amount === null ? "" : amount.replace(".", ",");
}

/** Kalem ekleme / düzenleme iletişim kutusu. Yalnızca açıkken çizilir; her açılışta sıfırdan başlar. */
export function ItemDialog({
  eventId,
  currency,
  item,
  onClose,
}: {
  eventId: string;
  currency: string;
  item: FinanceItem | null;
  onClose: () => void;
}) {
  const { busy, error, setError, run } = useFinanceAction();
  const [form, setForm] = useState<ItemForm>({
    direction: item?.direction ?? "expense",
    category: item?.category ?? CATEGORIES_BY_DIRECTION.expense[0]!,
    label: item?.label ?? "",
    estimated: amountText(item?.estimatedAmount ?? null),
    actual: amountText(item?.actualAmount ?? null),
    // Düzenleme tam değiştirmedir: mevcut not her zaman geri gönderilir.
    note: item?.note ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});

  const editing = item !== null;
  const categories = CATEGORIES_BY_DIRECTION[form.direction];

  function patch(next: Partial<ItemForm>, field?: keyof Errors) {
    setForm((prev) => ({ ...prev, ...next }));
    if (field) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function changeDirection(direction: FinanceDirection) {
    const allowed = CATEGORIES_BY_DIRECTION[direction];
    setForm((prev) => ({
      ...prev,
      direction,
      category: allowed.includes(prev.category) ? prev.category : allowed[0]!,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = itemFormToInput(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setError(null);
      document.getElementById(parsed.errors.estimated ? "item-estimated" : "item-actual")?.focus();
      return;
    }
    setErrors({});
    const { value } = parsed;
    const result = await run(
      () =>
        item
          ? updateFinanceItemAction({
              id: item.id,
              category: value.category,
              label: value.label,
              estimatedAmount: value.estimatedAmount,
              actualAmount: value.actualAmount,
              note: value.note,
            })
          : createFinanceItemAction({ eventId, ...value }),
      editing ? "Kalem güncellendi" : "Kalem eklendi",
    );
    if (result?.ok) {
      onClose();
    } else if (result && !result.ok) {
      const next: Errors = {};
      for (const [key, message] of Object.entries(firstFieldErrors(result.fieldErrors))) {
        const field = SERVER_FIELDS[key];
        if (field) next[field] = message;
      }
      setErrors(next);
    }
  }

  function fieldError(name: keyof Errors) {
    const message = errors[name];
    return message ? (
      <p id={`item-${name}-error`} className="text-sm text-destructive">
        {message}
      </p>
    ) : null;
  }
  const describedBy = (name: keyof Errors) => (errors[name] ? `item-${name}-error` : undefined);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Kalemi düzenle" : "Kalem ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {editing ? (
            <p className="text-sm text-muted-foreground">
              Yön: <span className="font-medium text-foreground">{FINANCE_DIRECTION_LABELS[form.direction]}</span>
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="item-direction">Yön</Label>
              <Select value={form.direction} onValueChange={(v) => changeDirection(v as FinanceDirection)}>
                <SelectTrigger id="item-direction" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {FINANCE_DIRECTION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="item-category">Kategori</Label>
            <Select
              value={form.category}
              onValueChange={(v) => patch({ category: v as ItemForm["category"] }, "category")}
            >
              <SelectTrigger
                id="item-category"
                className="h-11 w-full"
                aria-invalid={errors.category ? true : undefined}
                aria-describedby={describedBy("category")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {FINANCE_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("category")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-label">Kalem adı</Label>
            <Input
              id="item-label"
              className="h-11"
              value={form.label}
              maxLength={120}
              onChange={(e) => patch({ label: e.target.value }, "label")}
              aria-invalid={errors.label ? true : undefined}
              aria-describedby={describedBy("label")}
            />
            {fieldError("label")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-estimated">Tahmini tutar ({currency})</Label>
              <Input
                id="item-estimated"
                className="h-11"
                inputMode="decimal"
                value={form.estimated}
                onChange={(e) => patch({ estimated: e.target.value }, "estimated")}
                aria-invalid={errors.estimated ? true : undefined}
                aria-describedby={describedBy("estimated")}
              />
              {fieldError("estimated")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-actual">Gerçekleşen tutar ({currency})</Label>
              <Input
                id="item-actual"
                className="h-11"
                inputMode="decimal"
                value={form.actual}
                onChange={(e) => patch({ actual: e.target.value }, "actual")}
                aria-invalid={errors.actual ? true : undefined}
                aria-describedby={describedBy("actual")}
              />
              {fieldError("actual")}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-note">Not</Label>
            <Textarea
              id="item-note"
              value={form.note}
              maxLength={500}
              onChange={(e) => patch({ note: e.target.value }, "note")}
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={describedBy("note")}
            />
            {fieldError("note")}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose} disabled={busy}>
              Vazgeç
            </Button>
            <Button type="submit" className="h-11" disabled={busy}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
