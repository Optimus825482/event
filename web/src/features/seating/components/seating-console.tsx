"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import {
  ALLOCATION_LABELS,
  SALE_CATEGORIES,
  SALE_CATEGORY_LABELS,
  TABLE_ALLOCATIONS,
} from "@/domain/seating";
import { realtimeKeys } from "@/features/realtime/keys";
import { useEventStream } from "@/features/realtime/use-event-stream";
import { FloorPlanSwitcher } from "@/features/venue/components/floor-plan-switcher";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { classifyTablesAction, seatingOverviewAction, setSaleAllocationAction } from "../actions";
import type { SeatingOverview } from "../queries";
import { ALLOCATION_COLORS, CATEGORY_COLORS, planColors, seatingTotals, type SaleMove } from "../view-model";
import { SaleSettingsForm } from "./sale-settings-form";
import { SeatingBulkBar } from "./seating-bulk-bar";
import { SeatingTableList, type ClassifyPatch } from "./seating-table-list";

type ColorMode = "allocation" | "category";

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "allocation", label: "Tahsis" },
  { id: "category", label: "Kategori" },
];

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

const FAILED_MESSAGE = "İşlem tamamlanamadı";

const countText = (c: { tables: number; seats: number }) => `${c.tables} masa · ${c.seats} sandalye`;

/** "Masalar ve Satış" ekranı: özet, renkli plan, masa listesi, toplu işlemler ve satış kuralları. */
export function SeatingConsole({
  eventId,
  initial,
  canEdit,
}: {
  eventId: string;
  initial: SeatingOverview;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  useEventStream(eventId);

  const queryKey = useMemo(() => [...realtimeKeys.seats(eventId), "overview"] as const, [eventId]);
  const { data } = useQuery({
    queryKey,
    queryFn: async () => unwrap(await seatingOverviewAction({ eventId })),
    initialData: initial,
  });

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [colorMode, setColorMode] = useState<ColorMode>("allocation");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const { tables, plan, settings } = data;
  const totals = useMemo(() => seatingTotals(tables), [tables]);
  const colors = useMemo(() => planColors(tables, colorMode), [tables, colorMode]);
  const selectedTables = useMemo(() => tables.filter((t) => selectedIds.has(t.id)), [tables, selectedIds]);
  const outlinedIds = useMemo(() => selectedTables.map((t) => t.id), [selectedTables]);

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  /** Eylemi çalıştırır; sunucu mesajı toast'ta ve kalıcı uyarıda aynen gösterilir. */
  async function perform(call: () => Promise<ActionResult<{ updated: number }>>): Promise<boolean> {
    setBusy(true);
    setLastError(null);
    try {
      const result = await call();
      if (result.ok) {
        setLastError(null);
        toast.success(`${result.data.updated} masa güncellendi`);
        await refresh();
        return true;
      }
      setLastError(result.message);
      toast.error(result.message);
      return false;
    } catch {
      setLastError(FAILED_MESSAGE);
      toast.error(FAILED_MESSAGE);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const classify = (ids: readonly string[], patch: ClassifyPatch) =>
    perform(() => classifyTablesAction({ eventId, items: ids.map((tableId) => ({ tableId, ...patch })) }));
  const moveSelected = (move: SaleMove) =>
    perform(() => setSaleAllocationAction({ eventId, tableIds: selectedTables.map((t) => t.id), allocation: move }));

  const toggle = (tableId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(tableId)) next.add(tableId);
      return next;
    });

  const legend =
    colorMode === "allocation"
      ? TABLE_ALLOCATIONS.map((a) => ({ key: a, label: ALLOCATION_LABELS[a], color: ALLOCATION_COLORS[a] }))
      : SALE_CATEGORIES.map((c) => ({ key: c, label: SALE_CATEGORY_LABELS[c], color: CATEGORY_COLORS[c] }));

  return (
    <div className="min-w-0 space-y-6">
      <section aria-label="Özet" className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {TABLE_ALLOCATIONS.map((a) => (
            <li key={a} className="text-sm">
              <span className="font-semibold">{ALLOCATION_LABELS[a]}</span>: {countText(totals.byAllocation[a])}
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-3 text-sm">
          <span className="font-semibold">{SALE_CATEGORIES.map((c) => SALE_CATEGORY_LABELS[c]).join(" / ")}</span>
          : {SALE_CATEGORIES.map((c) => countText(totals.byCategory[c])).join(" / ")}
          <span className="block text-muted-foreground">Yalnızca online satıştaki ve beklemedeki masalar</span>
        </p>
      </section>

      <section
        aria-label="Alan planı"
        className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Renk" className="flex items-center gap-2">
            <span className="text-sm font-medium">Renk:</span>
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={colorMode === m.id}
                onClick={() => setColorMode(m.id)}
                className={cn(
                  "min-h-11 rounded-md border px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  colorMode === m.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ul aria-label="Renk açıklaması" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legend.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5 text-sm">
                <span
                  aria-hidden="true"
                  className="inline-block size-4 rounded-sm border border-foreground/60"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <FloorPlanSwitcher
          plan={plan}
          colorByTable={colors}
          outlinedIds={outlinedIds}
          onSelect={canEdit ? toggle : undefined}
          onSelectMany={canEdit ? (ids) => setSelectedIds(new Set(ids)) : undefined}
          height={420}
          ariaLabel="Masa alan planı"
        />
      </section>

      {canEdit && selectedTables.length > 0 ? (
        <SeatingBulkBar
          selected={selectedTables}
          settings={settings}
          pending={busy}
          onClassify={(patch) => void classify(selectedTables.map((t) => t.id), patch)}
          onMove={(move) => void moveSelected(move)}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : null}

      {lastError ? (
        <p role="alert" className="rounded-lg border border-destructive bg-card p-3 text-sm text-destructive">
          {lastError}
        </p>
      ) : null}

      <section
        aria-label="Masa listesi"
        className="min-w-0 rounded-xl border border-border bg-card p-2 text-card-foreground"
      >
        <SeatingTableList
          tables={tables}
          selectedIds={selectedIds}
          canEdit={canEdit}
          busy={busy}
          onToggle={toggle}
          onToggleAll={(checked) => setSelectedIds(checked ? new Set(tables.map((t) => t.id)) : new Set())}
          onClassifyOne={(tableId, patch) => classify([tableId], patch)}
          onInvalidInput={() => setLastError(null)}
        />
      </section>

      <SaleSettingsForm
        key={JSON.stringify([
          settings.sharedTables,
          settings.blockSingleLeftover,
          settings.locaOnline,
          settings.holdMinutes,
          settings.maxSeatsPerOrder,
          settings.saleStartsAt?.getTime() ?? null,
          settings.saleEndsAt?.getTime() ?? null,
        ])}
        eventId={eventId}
        settings={settings}
        canEdit={canEdit}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
