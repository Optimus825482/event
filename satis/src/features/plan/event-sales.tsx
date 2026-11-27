"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { holdAction } from "@/features/checkout/actions";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { imageUrl } from "@/lib/image-url";
import { formatEventTime } from "@/lib/time-zone";
import { dimmedTableIds, findTables, type KindFilter } from "./finder";
import { buildPlanModel } from "./model";
import { DEFAULT_PARTY_SIZE } from "./party";
import { PartySizeField } from "./party-step";
import {
  applyPick,
  autoPick,
  holdSignature,
  initialPicks,
  partyLimit,
  type PickAction,
  type PickRules,
  readiness,
  reconcilePicks,
  samePick,
  type TablePick,
} from "./picks";
import type { SeatView } from "./plan-3d";
import { PlanLegend } from "./plan-legend";
import { usePlanView } from "./plan-view";
import { PlanViewer } from "./plan-viewer";
import { picksTotal } from "./price";
import { SalonBrowser } from "./salon-browser";
import { SelectionSummary } from "./selection-summary";
import { SightlinePanel } from "./sightline-panel";
import { formatStageMetrics, tableStageMetrics } from "./stage-metrics";
import { TableDialog } from "./table-dialog";
import { TableFinder } from "./table-finder";
import { useAvailability } from "./use-availability";

export const SEAT_TAKEN_MESSAGE = "Seçtiğiniz sandalyelerden biri az önce alındı. Seçiminiz güncellendi.";

export type EventSalesProps = {
  event: EventDetail;
  initialAvailability: Availability;
  /** "Bilet Al" penceresinde seçilen kişi sayısı (1..event.sale.maxSeatsPerOrder). Verilmezse 2 ile başlar; panelden değişir. */
  initialPartySize?: number;
};

/**
 * 3B/2B salon planı, masa bulucu, masa penceresi (sahne görüşü, numaralı sandalye seçimi, ödemeye geçiş) ve tutma akışı.
 * Masa açılınca kişi sayısı kadar boş sandalye (bütün satılan masada masanın tamamı) önseçilir;
 * pencere seçime dokunulmadan kapatılırsa önseçim geri alınır.
 */
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

  const [state, setState] = useState(() =>
    initialPicks(Math.max(1, Math.min(limit, initialPartySize ?? DEFAULT_PARTY_SIZE))),
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [seatView, setSeatView] = useState<SeatView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogTableId, setDialogTableId] = useState<string | null>(null);
  /** Pencere açılırken yapılan önseçim; pencere dokunulmadan kapanırsa geri alınır. */
  const autoRef = useRef<TablePick | null>(null);

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

  /** Masayı pencerede açar; seçimi olmayan masada önseçim yapar. */
  const openTable = (tableId: string) => {
    const step = autoPick(state, tableId, model, rules);
    const before = state.picks.find((p) => p.tableId === tableId);
    const after = step.state.picks.find((p) => p.tableId === tableId) ?? null;
    autoRef.current = !before && after ? after : null;
    setState(step.state);
    setError(null);
    setNotice(step.notice);
    setDialogTableId(tableId);
  };

  const closeDialog = (revert: boolean) => {
    const auto = autoRef.current;
    autoRef.current = null;
    if (revert && auto && dialogTableId === auto.tableId) {
      const current = state.picks.find((p) => p.tableId === auto.tableId);
      if (samePick(current, auto)) {
        setState({ ...state, picks: state.picks.filter((p) => p.tableId !== auto.tableId) });
      }
    }
    setDialogTableId(null);
  };

  const handleSeat = (tableId: string, seatNo: number) => {
    runAction({ type: "toggleSeat", tableId, seatNo });
  };

  const finderTables = findTables(model, { query, kind, partySize: state.partySize });
  const dimmedIds = dimmedTableIds(model, { query, kind });
  const pickedIds = new Set(state.picks.map((p) => p.tableId));
  const activeTable = state.activeTableId ? (model.tables.find((t) => t.id === state.activeTableId) ?? null) : null;
  const total = picksTotal(state, model, event.prices);
  const readyInfo = readiness(state, model, rules);

  const lookFromTable = (tableId: string) => {
    view.setMode("3d");
    setSeatView((sv) => ({ tableId, nonce: (sv?.nonce ?? 0) + 1 }));
  };

  const dialogTable = dialogTableId ? (model.tables.find((t) => t.id === dialogTableId) ?? null) : null;
  const dialogPick = dialogTable ? (state.picks.find((p) => p.tableId === dialogTable.id) ?? null) : null;
  const dialogPrice = dialogTable?.category
    ? (event.prices.find((p) => p.category === dialogTable.category)?.price ?? null)
    : null;
  const dialogMetrics = dialogTable ? tableStageMetrics(model, dialogTable) : null;
  const otherPicks = state.picks
    .filter((p) => p.tableId !== dialogTableId)
    .map((p) => {
      const t = model.tables.find((x) => x.id === p.tableId);
      const label = t ? `${t.isLoca ? "Loca" : "Masa"} ${t.label}` : p.tableId;
      return p.whole ? `${label} · tamamı` : `${label} · sandalye ${p.seatNos.join(", ")}`;
    });
  const messages =
    error || notice ? (
      <>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
      </>
    ) : null;

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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-[16px] border border-line-gold bg-surface p-3 sm:p-4">
          {activeTable ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <button
                type="button"
                onClick={() => openTable(activeTable.id)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line-gold bg-glass px-3.5 py-1 text-xs font-semibold text-gold-bright transition-colors hover:border-gold hover:bg-surface-raised"
              >
                <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
                {`Seçili: ${activeTable.isLoca ? "Loca" : "Masa"} ${activeTable.label}`}
              </button>
            </div>
          ) : null}
          <PlanViewer
            model={model}
            view={view}
            picks={state.picks}
            activeTableId={state.activeTableId}
            dimmedIds={dimmedIds}
            artworkUrl={artworkUrl}
            title={event.name}
            seatView={seatView}
            onTable={openTable}
            onSeat={handleSeat}
          />
          <div className="border-t border-line pt-3">
            <PlanLegend prices={event.prices} currency={event.currency} />
          </div>
        </div>
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
          onFocus={openTable}
        />
        <SightlinePanel
          set={event.site.sightlineSet}
          table={activeTable ? { label: activeTable.label, isLoca: activeTable.isLoca } : null}
          canLookIn3d={view.can3d && !view.failed}
          onLookIn3d={() => {
            if (activeTable) lookFromTable(activeTable.id);
          }}
        />
        <SelectionSummary
          state={state}
          model={model}
          total={total}
          currency={event.currency}
          readiness={readyInfo}
          pending={pending}
          onRemove={(tableId) => runAction({ type: "removeTable", tableId })}
          onFocus={openTable}
          onContinue={proceed}
        >
          {dialogTable ? null : messages}
        </SelectionSummary>
      </aside>

      <TableDialog
        open={dialogTable !== null}
        table={dialogTable}
        eventName={event.name}
        eventTime={formatEventTime(event.startsAt)}
        sightlineSet={event.site.sightlineSet}
        metrics={dialogMetrics ? formatStageMetrics(dialogMetrics) : null}
        unitPrice={dialogPrice}
        currency={event.currency}
        canLookIn3d={view.can3d && !view.failed}
        onLookIn3d={() => {
          if (!dialogTable) return;
          closeDialog(false);
          lookFromTable(dialogTable.id);
        }}
        onClose={() => closeDialog(true)}
        sale={{
          pick: dialogPick,
          otherPicks,
          total,
          readiness: readyInfo,
          pending,
          onToggleSeat: (seatNo) => {
            if (dialogTable) handleSeat(dialogTable.id, seatNo);
          },
          onToggleWhole: () => {
            if (dialogTable) runAction({ type: "toggleWhole", tableId: dialogTable.id });
          },
          onProceed: proceed,
        }}
      >
        {dialogTable ? messages : null}
      </TableDialog>
    </div>
  );
}
