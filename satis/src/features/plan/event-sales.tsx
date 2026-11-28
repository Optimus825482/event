"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { holdAction } from "@/features/checkout/actions";
import type { Availability, EventDetail } from "@/lib/core/contract";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { imageUrl } from "@/lib/image-url";
import { formatEventTime } from "@/lib/time-zone";
import { dimmedTableIds, findTables, type KindFilter } from "./finder";
import { buildPlanModel } from "./model";
import { DEFAULT_PARTY_SIZE } from "./party";
import {
  applyPick,
  autoPick,
  holdSignature,
  initialPicks,
  partyLimit,
  type PickAction,
  type PickRules,
  pickedCount,
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
import { formatStageMetrics, tableStageMetrics } from "./stage-metrics";
import { TableDialog } from "./table-dialog";
import { useAvailability } from "./use-availability";

export const SEAT_TAKEN_MESSAGE = "Seçtiğiniz sandalyelerden biri az önce alındı. Seçiminiz güncellendi.";

export type EventSalesProps = {
  event: EventDetail;
  initialAvailability: Availability;
  /** "Bilet Al" penceresinde seçilen kişi sayısı (1..event.sale.maxSeatsPerOrder). Verilmezse 2 ile başlar. */
  initialPartySize?: number;
};

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "table", label: "Masa" },
  { value: "loca", label: "Loca" },
];

/**
 * Tam genişlikte 3B/2B salon arenası: üst kontrol çubuğu (alan filtresi, masa arama, kişi sayısı, seçili masa),
 * tam ekran salon görünümü ve masa tıklanınca açılan sahne görüşü / ödeme penceresi.
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
  const artworkUrl = useMemo(() => imageUrl(event.site.heroImage) ?? imageUrl(event.artistImage) ?? imageUrl(event.coverImage), [event.site.heroImage, event.artistImage, event.coverImage]);

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

  const trimmedQuery = query.trim();
  const finderTables = trimmedQuery
    ? findTables(model, { query: trimmedQuery, kind, partySize: state.partySize }).slice(0, 8)
    : [];
  const dimmedIds = dimmedTableIds(model, { query, kind });
  const activeTable = state.activeTableId ? (model.tables.find((t) => t.id === state.activeTableId) ?? null) : null;
  const total = picksTotal(state, model, event.prices);
  const readyInfo = readiness(state, model, rules);
  const selectedCount = pickedCount(state, model);

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
    <div className="flex flex-col gap-4">
      {/* Meritevent tarzı üst kontrol çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Alan filtresi" className="relative flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((f) => {
            const active = kind === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(f.value)}
                className={
                  active
                    ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-gold bg-glass px-3.5 py-1.5 text-xs font-semibold text-gold-bright transition-colors"
                    : "inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-gold hover:text-ivory"
                }
              >
                {f.value === "table" ? <span aria-hidden="true" className="size-2 rounded-full bg-ivory" /> : null}
                {f.value === "loca" ? <span aria-hidden="true" className="size-2 rounded-full bg-selection" /> : null}
                {f.label}
              </button>
            );
          })}

          <div className="relative w-full min-[480px]:w-auto">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Masa no ara (örn. 45)"
              aria-label="Masa numarası ara"
              className="min-h-10 w-full rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ivory placeholder:text-muted focus:border-gold min-[480px]:w-[195px]"
            />
            {trimmedQuery ? (
              <div
                role="region"
                aria-label="Masa arama sonuçları"
                className="absolute top-full left-0 z-30 mt-1.5 max-h-60 w-[min(16rem,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-line-gold bg-surface p-1.5 shadow-2xl"
              >
                {finderTables.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted">Eşleşen masa yok.</p>
                ) : (
                  finderTables.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setQuery("");
                        openTable(t.id);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-ivory transition-colors hover:bg-surface-raised"
                    >
                      <span className="font-semibold">{`${t.isLoca ? "Loca" : "Masa"} ${t.label}`}</span>
                      <span className="text-muted">{t.countLabel ?? "—"}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTable ? (
            <button
              type="button"
              onClick={() => openTable(activeTable.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-gold bg-glass px-3.5 py-1.5 text-xs font-semibold text-gold-bright transition-colors hover:border-gold"
            >
              <span aria-hidden="true" className="size-2 rounded-full bg-selection" />
              {`Seçili: ${activeTable.isLoca ? "Loca" : "Masa"} ${activeTable.label}`}
            </button>
          ) : null}

          <div
            aria-label="Kişi sayısı"
            className="inline-flex min-h-10 flex-wrap items-center gap-2 rounded-full border border-line-gold bg-surface px-3 py-1 text-xs font-semibold text-ivory tabular-nums"
          >
            <span className="text-muted">Kişi Sayısı:</span>
            <button
              type="button"
              aria-label="Kişi sayısını azalt"
              disabled={state.partySize <= 1}
              onClick={() => runAction({ type: "setPartySize", partySize: state.partySize - 1 })}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-raised text-sm font-bold text-ivory hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
            >
              −
            </button>
            <span role="status" className="inline-flex flex-wrap items-center gap-1.5">
              <b className="min-w-4 text-center">{`${state.partySize} Kişi`}</b>
              <span className="text-gold-bright">{`· ${selectedCount}/${state.partySize} kişi seçildi`}</span>
            </span>
            <button
              type="button"
              aria-label="Kişi sayısını artır"
              disabled={state.partySize >= limit}
              onClick={() => runAction({ type: "setPartySize", partySize: state.partySize + 1 })}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-raised text-sm font-bold text-ivory hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
            >
              +
            </button>
          </div>

          {state.picks.length > 0 ? (
            <Button variant="gold" disabled={!readyInfo.ready || pending || total === null} onClick={proceed} className="min-h-10 px-4 py-1.5 text-xs">
              {pending ? "Yeriniz ayrılıyor…" : "Devam et"}
            </Button>
          ) : null}
        </div>
      </div>

      {!dialogTable && messages ? <div className="flex flex-col gap-2">{messages}</div> : null}

      {/* Tam genişlik salon arenası */}
      <div className="flex flex-col gap-3 rounded-[20px] border border-line-gold bg-surface p-2.5 sm:p-4">
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

      <TableDialog
        model={model}
        artworkUrl={artworkUrl}
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
