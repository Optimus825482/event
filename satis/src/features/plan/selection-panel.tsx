"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney, multiplyMoney } from "@/lib/format";
import type { PlanTableModel } from "./model";

type SelectionPanelProps = {
  table: PlanTableModel | null;
  quantity: number;
  options: number[];
  /** Sandalye başına fiyat (ondalıklı dizgi); fiyatsız masada `null`. */
  unitPrice: string | null;
  currency: string;
  pending: boolean;
  onQuantity(quantity: number): void;
  onContinue(): void;
  children?: ReactNode;
};

const SKIP_HINT = "Masada tek boş sandalye kalmaması için bazı adetler seçilemez.";

/** Alt seçim paneli: seçili masa, adet adımlayıcı, toplam ve "Devam et". */
export function SelectionPanel({ table, quantity, options, unitPrice, currency, pending, onQuantity, onContinue, children }: SelectionPanelProps) {
  const index = options.indexOf(quantity);
  const kind = table?.isLoca ? "Loca" : "Masa";
  const skipped = table !== null && !table.wholeOnly && options.some((q, i) => q !== i + 1);
  const canContinue = table !== null && index >= 0 && unitPrice !== null && !pending;

  return (
    <section aria-label="Seçiminiz" className="flex flex-col gap-3 rounded-xl border border-gold bg-surface p-4">
      {table ? (
        <>
          <h2 className="m-0 text-lg font-semibold text-gold">{[`${kind} ${table.label}`, table.categoryLabel].filter(Boolean).join(" · ")}</h2>
          <p className="m-0 text-ivory">{`Boş sandalye ${table.countLabel}`}</p>
          {table.wholeOnly ? <p className="m-0 text-muted">Bu masa yalnızca bütün olarak alınır.</p> : null}
          <div className="flex items-center gap-3">
            <Button variant="glass" aria-label="Adedi azalt" disabled={pending || index <= 0} onClick={() => onQuantity(options[index - 1] as number)}>
              −
            </Button>
            <span aria-live="polite" className="min-w-16 text-center text-lg font-semibold text-ivory">{`${quantity} kişi`}</span>
            <Button variant="glass" aria-label="Adedi artır" disabled={pending || index < 0 || index >= options.length - 1} onClick={() => onQuantity(options[index + 1] as number)}>
              +
            </Button>
          </div>
          {skipped ? <p className="m-0 text-muted">{SKIP_HINT}</p> : null}
          {unitPrice !== null ? (
            <p className="m-0 text-xl font-semibold text-ivory">{formatMoney(multiplyMoney(unitPrice, quantity), currency)}</p>
          ) : (
            <p className="m-0 text-muted">Bu masanın fiyatı henüz belirlenmedi.</p>
          )}
        </>
      ) : (
        <p className="m-0 text-ivory">Plandan ya da listeden bir masa seçin.</p>
      )}
      {children}
      <Button variant="gold" size="lg" disabled={!canContinue} onClick={onContinue}>
        {pending ? "Masa ayrılıyor…" : "Devam et"}
      </Button>
    </section>
  );
}
