"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { holdAction } from "@/features/checkout/actions";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { buildPlanModel } from "./model";
import { PlanViewer } from "./plan-viewer";
import { optionsFor, reconcileSelection, type Selection } from "./selection";
import { SelectionPanel } from "./selection-panel";
import { TableList } from "./table-list";
import { useAvailability } from "./use-availability";

type View = "plan" | "list";

/** Plan + liste görünümü, canlı durum ve masa/adet seçimi; "Devam et" masayı tutar. */
export function EventSales({ event, initialAvailability }: { event: EventDetail; initialAvailability: Availability }) {
  const router = useRouter();
  const { availability, stale, refresh, patch } = useAvailability(event.id, initialAvailability);
  const [view, setView] = useState<View>("plan");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Tutma isteğinin yeniden denenmesi için: aynı seçimde aynı anahtar; yalnızca bellekte tutulur.
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const { maxSeatsPerOrder, blockSingleLeftover } = event.sale;
  const rules = useMemo(() => ({ maxSeatsPerOrder, blockSingleLeftover }), [maxSeatsPerOrder, blockSingleLeftover]);
  const model = useMemo(() => buildPlanModel(event.plan, event.prices, availability), [event.plan, event.prices, availability]);

  // Canlı durum seçimi geçersiz kıldıysa render sırasında düzeltilir.
  const reconciled = reconcileSelection(selection, model, rules);
  if (reconciled.selection !== selection) {
    setSelection(reconciled.selection);
    setNotice(reconciled.notice);
  }

  const table = selection ? (model.tables.find((t) => t.id === selection.tableId) ?? null) : null;
  const options = selection ? optionsFor(model, selection.tableId, rules) : [];
  const unitPrice = table?.category ? (event.prices.find((p) => p.category === table.category)?.price ?? null) : null;

  const choose = (tableId: string) => {
    const list = optionsFor(model, tableId, rules);
    const first = list[0];
    if (first === undefined) return;
    setError(null);
    setNotice(null);
    setSelection({ tableId, quantity: first });
  };

  const changeQuantity = (quantity: number) => {
    if (!selection) return;
    setError(null);
    setNotice(null);
    setSelection({ tableId: selection.tableId, quantity });
  };

  const proceed = async () => {
    if (!selection || pending) return;
    const signature = `${selection.tableId}:${selection.quantity}`;
    if (keyRef.current?.signature !== signature) keyRef.current = { signature, key: crypto.randomUUID() };
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await holdAction({ eventId: event.id, tableId: selection.tableId, quantity: selection.quantity, clientKey: keyRef.current.key });
      if (result.ok) {
        router.push(`/odeme/${result.data.orderToken}`);
        return;
      }
      setError(result.message);
      if (result.details?.tableId !== undefined && result.details.free !== undefined) patch(result.details.tableId, result.details.free);
      refresh();
      if (result.code === "sales_closed") router.refresh();
    } catch {
      setError(ERROR_MESSAGES.core_unreachable);
    }
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Görünüm" className="flex gap-2">
        {(["plan", "list"] as const).map((v) => (
          <Button
            key={v}
            variant={view === v ? "gold" : "glass"}
            aria-pressed={view === v}
            className="flex-1 sm:flex-none"
            onClick={() => setView(v)}
          >
            {v === "plan" ? "Plan" : "Liste"}
          </Button>
        ))}
      </div>
      {stale ? <Notice>Canlı durum güncellenemiyor.</Notice> : null}
      {view === "plan" ? (
        <PlanViewer model={model} selectedId={selection?.tableId ?? null} onSelect={choose} />
      ) : (
        <TableList model={model} selectedId={selection?.tableId ?? null} onSelect={choose} prices={event.prices} currency={event.currency} />
      )}
      <SelectionPanel
        table={table}
        quantity={selection?.quantity ?? 0}
        options={options}
        unitPrice={unitPrice}
        currency={event.currency}
        pending={pending}
        onQuantity={changeQuantity}
        onContinue={() => void proceed()}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
      </SelectionPanel>
    </div>
  );
}
