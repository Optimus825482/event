"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFinancePlanAction } from "../actions";
import { CASINO_COST_MODE_LABELS, CASINO_COST_MODES, type CasinoCostMode } from "../constants";
import { parseMoneyInput } from "../money";
import type { FinanceOverview } from "../overview";
import { AMOUNT_INPUT_ERROR } from "../view-model";
import { firstFieldErrors, useFinanceAction } from "./use-finance-action";

type Errors = Partial<Record<"targetProfit" | "casinoTransferPrice", string>>;

const toText = (amount: string) => amount.replace(".", ",");

/** Hedef kâr ve Casino maliyet payı formu. */
export function PlanForm({ overview }: { overview: FinanceOverview }) {
  const { plan, currency, event, permissions } = overview;
  const canEdit = permissions.edit;
  const { busy, error, setError, run } = useFinanceAction();
  const [targetProfit, setTargetProfit] = useState(toText(plan.targetProfit));
  const [mode, setMode] = useState<CasinoCostMode>(plan.casinoCostMode);
  const [transfer, setTransfer] = useState(toText(plan.casinoTransferPrice));
  const [errors, setErrors] = useState<Errors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const next: Errors = {};
    const profit = parseMoneyInput(targetProfit);
    if (profit === null) next.targetProfit = AMOUNT_INPUT_ERROR;
    // Fiyat alanı yalnızca "transfer" seçiliyken görünür; aksi hâlde kayıtlı değer korunur.
    const transferPrice = mode === "transfer" ? parseMoneyInput(transfer) : plan.casinoTransferPrice;
    if (transferPrice === null) next.casinoTransferPrice = AMOUNT_INPUT_ERROR;
    if (profit === null || transferPrice === null) {
      setErrors(next);
      setError(null);
      return;
    }
    setErrors({});
    const result = await run(
      () =>
        saveFinancePlanAction({
          eventId: event.id,
          targetProfit: profit,
          casinoCostMode: mode,
          casinoTransferPrice: transferPrice,
        }),
      "Plan kaydedildi",
    );
    if (result && !result.ok) {
      const server = firstFieldErrors(result.fieldErrors);
      setErrors({ targetProfit: server.targetProfit, casinoTransferPrice: server.casinoTransferPrice });
    }
  }

  return (
    <section
      role="region"
      aria-labelledby="finance-plan-heading"
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="finance-plan-heading" className="text-lg font-semibold">
        Hedef kâr ve Casino payı
      </h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-target-profit">Hedef kâr</Label>
            <div className="flex items-center gap-2">
              <Input
                id="plan-target-profit"
                className="h-11"
                inputMode="decimal"
                value={targetProfit}
                readOnly={!canEdit}
                onChange={(e) => {
                  setTargetProfit(e.target.value);
                  setErrors((prev) => ({ ...prev, targetProfit: undefined }));
                }}
                aria-invalid={errors.targetProfit ? true : undefined}
                aria-describedby={errors.targetProfit ? "plan-target-profit-error" : undefined}
              />
              <span className="text-sm text-muted-foreground">{currency}</span>
            </div>
            {errors.targetProfit ? (
              <p id="plan-target-profit-error" className="text-sm text-destructive">
                {errors.targetProfit}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-casino-mode">Casino maliyet payı</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as CasinoCostMode)} disabled={!canEdit}>
              <SelectTrigger id="plan-casino-mode" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASINO_COST_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {CASINO_COST_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "transfer" ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-transfer-price">Sandalye başı transfer fiyatı</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="plan-transfer-price"
                  className="h-11"
                  inputMode="decimal"
                  value={transfer}
                  readOnly={!canEdit}
                  onChange={(e) => {
                    setTransfer(e.target.value);
                    setErrors((prev) => ({ ...prev, casinoTransferPrice: undefined }));
                  }}
                  aria-invalid={errors.casinoTransferPrice ? true : undefined}
                  aria-describedby={errors.casinoTransferPrice ? "plan-transfer-price-error" : undefined}
                />
                <span className="text-sm text-muted-foreground">{currency}</span>
              </div>
              {errors.casinoTransferPrice ? (
                <p id="plan-transfer-price-error" className="text-sm text-destructive">
                  {errors.casinoTransferPrice}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {canEdit ? (
          <Button type="submit" className="h-11" disabled={busy}>
            Planı kaydet
          </Button>
        ) : null}
      </form>
    </section>
  );
}
