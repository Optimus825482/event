"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { holdAction } from "@/features/checkout/actions";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { imageUrl } from "@/lib/image-url";
import { ActiveTableCard } from "./active-table-card";
import { dimmedTableIds, findTables, type KindFilter } from "./finder";
import { buildPlanModel } from "./model";
import { DEFAULT_PARTY_SIZE } from "./party";
import { PartySizeField, PartyStep } from "./party-step";
import {
  applyPick,
  holdSignature,
  initialPicks,
  partyLimit,
  type PickAction,
  type PickRules,
  readiness,
  reconcilePicks,
} from "./picks";
import type { SeatView } from "./plan-3d";
import { PlanLegend } from "./plan-legend";
import { usePlanView } from "./plan-view";
import { PlanViewer } from "./plan-viewer";
import { picksTotal } from "./price";
import { SalonBrowser } from "./salon-browser";
import { SelectionSummary } from "./selection-summary";
import { SightlinePanel } from "./sightline-panel";
import { TableFinder } from "./table-finder";
import { useAvailability } from "./use-availability";

export const SEAT_TAKEN_MESSAGE = "Seçtiğiniz sandalyelerden biri az önce alındı. Seçiminiz güncellendi.";

export type EventSalesProps = {
  event: EventDetail;
  initialAvailability: Availability;
  /** "Bilet Al" adımında seçilen kişi sayısı (1..event.sale.maxSeatsPerOrder). Verilmezse PartyStep sorulur. */
  initialPartySize?: number;
};

/** 3B/2B salon planı, masa bulucu, numaralı sandalye seçimi, sahne görüşü ve tutma akışı. */
export function EventSales({ event, initialAvailability, initialPartySize }: EventSalesProps) {
  const router = useRouter();
  const { availability, stale, refresh, patch } = useAvailability(event.id, initialAvailability);
  const view = usePlanView();

  const { maxSeatsPerOrder, blockSingleLeftover } = event.sale;
  const rules: PickRules = useMemo(
    () => ({ maxSeatsPerOrder, blockSingleLeftover }),
    [maxSeatsPerOrder, blockSingleLeftover],
  );
  const limit = partyLimit(rules);

  const [partyConfirmed, setPartyConfirmed] = useState(initialPartySize !== undefined);
  const [state, setState] = useState(() =>
    initialPicks(Math.max(1, Math.min(limit, initialPartySize ?? DEFAULT_PARTY_SIZE))),
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [seatView, setSeatView] = useState<SeatView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const model = useMemo(
    () => buildPlanModel(event.plan, event.prices, availability, event.sale.mode),
    [event.plan, event.prices, availability, event.sale.mode],
  );
  const artworkUrl = useMemo(() => imageUrl(event.site.heroImage ?? event.artistImage), [event.site.heroImage, event.artistImage]);

  // Satış kapalıyken de salon 3B gezilir ve masadan sahne görüşü gösterilir; yalnızca seçim/tutma yoktur.
  if (event.sale.state !== "open") {
    return <SalonBrowser event={event} model={model} view={view} artworkUrl={artworkUrl} />;
  }

  if (!partyConfirmed) {
    return (
      <div className="flex flex-col gap-6">
        <PartyStep
          max={limit}
          initial={Math.min(DEFAULT_PARTY_SIZE, limit)}
          onConfirm={(partySize) => {
            setState(initialPicks(partySize));
            setPartyConfirmed(true);
          }}
        />
        <SalonBrowser event={event} model={model} view={view} artworkUrl={artworkUrl} />
      </div>
    );
  }

  // Canlı yoklama seçimi geçersiz kıldıysa (tutma isteği sürerken değil) render sırasında uzlaştırılır.
  if (!pending) {
    const reconciled = reconcilePicks(state, model);
    if (reconciled.state !== state) {
      setState(reconciled.state);
      setNotice(reconciled.notice);
    }
  }

  const runAction = (action: PickAction) => {
    const step = applyPick(state, action, model, rules);
    setState(step.state);
    setError(null);
    setNotice(step.notice);
  };

  const handleTable = (tableId: string) => {
    const target = model.tables.find((t) => t.id === tableId);
    if (target?.wholeOnly) {
      const focused = applyPick(state, { type: "focus", tableId }, model, rules);
      const toggled = applyPick(focused.state, { type: "toggleWhole", tableId }, model, rules);
      setState(toggled.state);
      setError(null);
      setNotice(toggled.notice);
      return;
    }
    runAction({ type: "focus", tableId });
  };

  const handleSeat = (tableId: string, seatNo: number) => {
    runAction({ type: "toggleSeat", tableId, seatNo });
  };

  const finderTables = findTables(model, { query, kind, partySize: state.partySize });
  const dimmedIds = dimmedTableIds(model, { query, kind });
  const pickedIds = new Set(state.picks.map((p) => p.tableId));
  const activeTable = state.activeTableId ? (model.tables.find((t) => t.id === state.activeTableId) ?? null) : null;
  const activePick = activeTable ? (state.picks.find((p) => p.tableId === activeTable.id) ?? null) : null;
  const unitPrice = activeTable?.category
    ? (event.prices.find((p) => p.category === activeTable.category)?.price ?? null)
    : null;
  const total = picksTotal(state, model, event.prices);
  const readyInfo = readiness(state, model, rules);

  const proceed = async () => {
    if (!readyInfo.ready || pending || total === null) return;
    const signature = holdSignature(readyInfo.items);
    if (keyRef.current?.signature !== signature) {
      keyRef.current = { signature, key: crypto.randomUUID() };
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await holdAction({
        eventId: event.id,
        items: readyInfo.items,
        clientKey: keyRef.current.key,
      });
      if (result.ok) {
        router.push(`/odeme/${result.data.orderToken}`);
        return;
      }
      const hasSeatItems = readyInfo.items.some((i) => i.seatNos !== undefined);
      setError(result.code === "seats_unavailable" && hasSeatItems ? SEAT_TAKEN_MESSAGE : result.message);
      if (result.details?.tableId !== undefined && result.details.free !== undefined) {
        patch(result.details.tableId, result.details.free);
      }
      refresh();
      if (result.code === "sales_closed") router.refresh();
    } catch {
      setError(ERROR_MESSAGES.core_unreachable);
    }
    setPending(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex flex-col gap-3">
        <PlanViewer
          model={model}
          view={view}
          picks={state.picks}
          activeTableId={state.activeTableId}
          dimmedIds={dimmedIds}
          artworkUrl={artworkUrl}
          title={event.name}
          seatView={seatView}
          onTable={handleTable}
          onSeat={handleSeat}
        />
        <PlanLegend prices={event.prices} currency={event.currency} />
        {stale ? (
          <Notice>Canlı doluluk güncellenemedi; bilgiler birkaç saniye gecikmeli olabilir.</Notice>
        ) : null}
      </div>

      <aside aria-label="Bilet seçimi" className="flex flex-col gap-4">
        <PartySizeField
          value={state.partySize}
          max={limit}
          disabled={pending}
          onChange={(partySize) => runAction({ type: "setPartySize", partySize })}
        />
        <TableFinder
          tables={finderTables}
          query={query}
          kind={kind}
          partySize={state.partySize}
          activeTableId={state.activeTableId}
          pickedIds={pickedIds}
          prices={event.prices}
          currency={event.currency}
          onQuery={setQuery}
          onKind={setKind}
          onFocus={(tableId) => runAction({ type: "focus", tableId })}
        />
        <SightlinePanel
          set={event.site.sightlineSet}
          table={activeTable ? { label: activeTable.label, isLoca: activeTable.isLoca } : null}
          canLookIn3d={view.can3d && !view.failed}
          onLookIn3d={() => {
            if (!activeTable) return;
            view.setMode("3d");
            setSeatView((sv) => ({ tableId: activeTable.id, nonce: (sv?.nonce ?? 0) + 1 }));
          }}
        />
        <ActiveTableCard
          table={activeTable}
          pick={activePick}
          unitPrice={unitPrice}
          currency={event.currency}
          disabled={pending}
          onToggleSeat={(seatNo) => activeTable && handleSeat(activeTable.id, seatNo)}
          onToggleWhole={() => activeTable && runAction({ type: "toggleWhole", tableId: activeTable.id })}
        />
        <SelectionSummary
          state={state}
          model={model}
          total={total}
          currency={event.currency}
          readiness={readyInfo}
          pending={pending}
          onRemove={(tableId) => runAction({ type: "removeTable", tableId })}
          onFocus={(tableId) => runAction({ type: "focus", tableId })}
          onContinue={proceed}
        >
          {error ? <Notice tone="error">{error}</Notice> : null}
          {notice ? <Notice>{notice}</Notice> : null}
        </SelectionSummary>
      </aside>
    </div>
  );
}
