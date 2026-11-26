"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import { formatDate } from "@/lib/utils";
import { computeRecommendationAction, saveCoefficientsAction, saveFinalPricesAction } from "../actions";
import { CASINO_COST_MODE_LABELS } from "../constants";
import { formatMoney } from "../money";
import type { FinanceOverview } from "../overview";
import type { RecommendationView } from "../recommendation-service";
import { finalPricesFromForm, priceRows, recommendationNote } from "../view-model";
import { firstFieldErrors, useFinanceAction } from "./use-finance-action";

export type ComputedRecommendation = { view: RecommendationView; stamp: string };

/** Tavsiyenin dayandığı verinin parmak izi; değişince eski varsayımlar gösterilmez. */
export function recommendationStamp(o: FinanceOverview): string {
  return JSON.stringify([o.summary, o.plan.targetProfit, o.plan.casinoCostMode, o.plan.casinoTransferPrice, o.seats]);
}

type Texts = Record<SaleCategory, string>;
type CategoryErrors = Partial<Record<SaleCategory, string>>;

/** Katsayı girdisi: virgül de kabul edilir; doğrulama sunucudadır. */
const coefficientValue = (text: string) => text.trim().replace(",", ".");

function pickTexts(read: (category: SaleCategory) => string): Texts {
  return { standard: read("standard"), premium: read("premium"), vip: read("vip") };
}

/** Katsayılar, tavsiye hesabı ve kesin fiyatlar. */
export function PricingSection({
  overview,
  computed,
  onComputed,
}: {
  overview: FinanceOverview;
  computed: ComputedRecommendation | null;
  onComputed: (value: ComputedRecommendation) => void;
}) {
  const { currency, event, plan, permissions, pricesLocked } = overview;
  const rows = priceRows(overview);
  const canEdit = permissions.edit && !pricesLocked;
  const readOnly = !permissions.edit;

  const [coefficients, setCoefficients] = useState<Texts>(() =>
    pickTexts((c) => rows.find((r) => r.category === c)!.coefficient),
  );
  const [finals, setFinals] = useState<Texts>(() => pickTexts((c) => rows.find((r) => r.category === c)!.finalPrice));
  const [coefficientErrors, setCoefficientErrors] = useState<CategoryErrors>({});
  const [finalErrors, setFinalErrors] = useState<CategoryErrors>({});

  const coefficientsAction = useFinanceAction();
  const computeAction = useFinanceAction();
  const finalsAction = useFinanceAction();
  const busy = coefficientsAction.busy || computeAction.busy || finalsAction.busy;

  // Varsayımlar yalnızca hesaplandıkları verilerle birlikte geçerlidir; veri değişince gizlenir.
  const stamp = recommendationStamp(overview);
  const assumptions = computed && computed.stamp === stamp ? computed.view : null;
  const note = assumptions ? recommendationNote(assumptions) : null;

  const finalsForm = finalPricesFromForm(finals);
  const hasFinals = finalsForm.ok ? Object.keys(finalsForm.prices).length > 0 : true;
  const coefficientsDirty = SALE_CATEGORIES.some(
    (c) => coefficientValue(coefficients[c]) !== rows.find((r) => r.category === c)!.coefficient,
  );

  async function saveCoefficients() {
    const result = await coefficientsAction.run(
      () =>
        saveCoefficientsAction({
          eventId: event.id,
          coefficients: {
            standard: coefficientValue(coefficients.standard),
            premium: coefficientValue(coefficients.premium),
            vip: coefficientValue(coefficients.vip),
          },
        }),
      "Katsayılar kaydedildi",
    );
    if (result && !result.ok) {
      const server = firstFieldErrors(result.fieldErrors);
      const next: CategoryErrors = {};
      for (const c of SALE_CATEGORIES) next[c] = server[`coefficients.${c}`];
      setCoefficientErrors(next);
    } else {
      setCoefficientErrors({});
    }
  }

  async function compute() {
    const result = await computeAction.run(() => computeRecommendationAction({ eventId: event.id }), "Tavsiye hesaplandı");
    if (result?.ok) onComputed({ view: result.data, stamp });
  }

  async function saveFinals() {
    const parsed = finalPricesFromForm(finals);
    if (!parsed.ok) {
      setFinalErrors(parsed.errors);
      finalsAction.setError(null);
      return;
    }
    if (Object.keys(parsed.prices).length === 0) return;
    setFinalErrors({});
    const result = await finalsAction.run(
      () => saveFinalPricesAction({ eventId: event.id, prices: parsed.prices }),
      "Fiyatlar kaydedildi",
    );
    if (result && !result.ok) {
      const server = firstFieldErrors(result.fieldErrors);
      const next: CategoryErrors = {};
      for (const c of SALE_CATEGORIES) next[c] = server[`prices.${c}`];
      setFinalErrors(next);
    }
  }

  return (
    <section
      role="region"
      aria-labelledby="finance-pricing-heading"
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="finance-pricing-heading" className="text-lg font-semibold">
        Fiyatlandırma
      </h2>
      <p className="text-sm text-muted-foreground">Tavsiye yalnızca öneridir; kesin fiyatı siz girersiniz.</p>
      {pricesLocked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          Tamamlanmış veya iptal edilmiş etkinliğin fiyatı değiştirilemez.
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Satılabilir sandalye</TableHead>
            <TableHead>Katsayı</TableHead>
            <TableHead className="text-right">Tavsiye</TableHead>
            <TableHead>Kesin fiyat ({currency})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const coefficientError = coefficientErrors[row.category];
            const finalError = finalErrors[row.category];
            return (
              <TableRow key={row.category}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.seats}</TableCell>
                <TableCell className="align-top">
                  <Input
                    aria-label={`${row.label} katsayı`}
                    className="h-11 w-28"
                    inputMode="decimal"
                    value={coefficients[row.category]}
                    readOnly={readOnly}
                    disabled={pricesLocked}
                    onChange={(e) => {
                      setCoefficients((prev) => ({ ...prev, [row.category]: e.target.value }));
                      setCoefficientErrors((prev) => ({ ...prev, [row.category]: undefined }));
                    }}
                    aria-invalid={coefficientError ? true : undefined}
                    aria-describedby={coefficientError ? `coefficient-${row.category}-error` : undefined}
                  />
                  {coefficientError ? (
                    <p id={`coefficient-${row.category}-error`} className="mt-1 whitespace-normal text-sm text-destructive">
                      {coefficientError}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.recommended === null ? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">Hesaplanmadı</span>
                    </>
                  ) : (
                    `${row.recommended} ${currency}`
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`${row.label} kesin fiyat`}
                      className="h-11 w-36"
                      inputMode="decimal"
                      value={finals[row.category]}
                      readOnly={readOnly}
                      disabled={pricesLocked}
                      onChange={(e) => {
                        setFinals((prev) => ({ ...prev, [row.category]: e.target.value }));
                        setFinalErrors((prev) => ({ ...prev, [row.category]: undefined }));
                      }}
                      aria-invalid={finalError ? true : undefined}
                      aria-describedby={finalError ? `final-${row.category}-error` : undefined}
                    />
                    {row.required ? (
                      <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400">
                        Kesin fiyat gerekli
                      </span>
                    ) : null}
                  </div>
                  {finalError ? (
                    <p id={`final-${row.category}-error`} className="mt-1 whitespace-normal text-sm text-destructive">
                      {finalError}
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {canEdit ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={saveCoefficients}>
              Katsayıları kaydet
            </Button>
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={compute}>
              Tavsiye fiyatı hesapla
            </Button>
            <Button type="button" className="h-11" disabled={busy || !hasFinals} onClick={saveFinals}>
              Fiyatları kaydet
            </Button>
          </div>
          {coefficientsDirty ? (
            <p className="text-sm text-muted-foreground">Kaydedilmemiş katsayılar tavsiye hesabına girmez.</p>
          ) : null}
          {!hasFinals ? (
            <p className="text-sm text-muted-foreground">Fiyatları kaydetmek için en az bir kesin fiyat girin.</p>
          ) : null}
        </div>
      ) : null}

      {[coefficientsAction, computeAction, finalsAction].map((action, index) =>
        action.error ? (
          <p key={index} role="alert" className="text-sm text-destructive">
            {action.error}
          </p>
        ) : null,
      )}

      {plan.recommendedAt ? (
        <p className="text-sm text-muted-foreground">Son hesaplama: {formatDate(plan.recommendedAt, "datetime")}</p>
      ) : null}

      {assumptions ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold">Varsayımlar</h3>
          <ul className="space-y-1 text-sm">
            <li>
              Tahmini gider: {formatMoney(assumptions.assumptions.estimatedExpense)} {currency}
            </li>
            <li>
              Hedef kâr: {formatMoney(assumptions.assumptions.targetProfit)} {currency}
            </li>
            <li>
              Casino payı: {formatMoney(assumptions.assumptions.casinoShare)} {currency} (
              {CASINO_COST_MODE_LABELS[assumptions.assumptions.casinoCostMode]},{" "}
              {assumptions.assumptions.casinoCapacity} sandalye)
            </li>
            <li>
              Tahmini diğer gelir: {formatMoney(assumptions.assumptions.estimatedOtherIncome)} {currency}
            </li>
            <li>
              Dağıtılacak tutar: {formatMoney(assumptions.assumptions.distributable)} {currency}
            </li>
            <li>
              Katsayı 1 için birim: {formatMoney(assumptions.base)} {currency}
            </li>
            <li>Loca dahil: {assumptions.assumptions.locaOnline ? "Evet" : "Hayır"}</li>
          </ul>
          {note ? (
            <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-400">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
