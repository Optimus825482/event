"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { PlanModel } from "./model";
import { pickedCount, type PickState, type Readiness } from "./picks";

export function SelectionSummary({
  state,
  model,
  total,
  currency,
  readiness,
  pending,
  onRemove,
  onFocus,
  onContinue,
  children,
}: {
  state: PickState;
  model: PlanModel;
  total: string | null;
  currency: string;
  readiness: Readiness;
  pending: boolean;
  onRemove(tableId: string): void;
  onFocus(tableId: string): void;
  onContinue(): void;
  children?: ReactNode;
}) {
  const byId = new Map(model.tables.map((t) => [t.id, t]));
  const count = pickedCount(state, model);
  const canContinue = readiness.ready && !pending && total !== null;

  return (
    <section aria-label="Seçiminiz" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ivory">Seçiminiz</h3>
        <span role="status" className="text-sm font-medium text-gold">
          {count}/{state.partySize} kişi seçildi
        </span>
      </div>

      {state.picks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {state.picks.map((pick) => {
            const table = byId.get(pick.tableId);
            const label = table ? `${table.isLoca ? "Loca" : "Masa"} ${table.label}` : pick.tableId;
            const detail = pick.whole
              ? `${label} · tamamı (${table?.seats ?? 0} kişi)`
              : `${label} · sandalye ${pick.seatNos.join(", ")}`;
            return (
              <li
                key={pick.tableId}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => onFocus(pick.tableId)}
                  className="text-left text-ivory hover:text-gold"
                >
                  {detail}
                </button>
                <button
                  type="button"
                  aria-label={`${label} seçimini kaldır`}
                  disabled={pending}
                  onClick={() => onRemove(pick.tableId)}
                  className="min-h-11 px-2 text-xs font-medium text-muted hover:text-danger disabled:opacity-50"
                >
                  Kaldır
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {children}

      {total === null ? (
        <p className="text-sm text-danger">Seçilen masalardan birinin fiyatı henüz belirlenmedi.</p>
      ) : state.picks.length > 0 ? (
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <span className="text-sm text-muted">Toplam</span>
          <span className="text-lg font-semibold text-gold">{formatMoney(total, currency)}</span>
        </div>
      ) : null}

      {!readiness.ready && readiness.reason ? <p className="text-sm text-muted">{readiness.reason}</p> : null}

      <Button size="lg" disabled={!canContinue} onClick={onContinue}>
        {pending ? "Yeriniz ayrılıyor…" : "Devam et"}
      </Button>
    </section>
  );
}
