"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ALLOCATION_LABELS, TABLE_ALLOCATIONS } from "@/domain/seating";
import { realtimeKeys } from "@/features/realtime/keys";
import { useEventStream } from "@/features/realtime/use-event-stream";
import { FloorPlanSwitcher } from "@/features/venue/components/floor-plan-switcher";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { allocateToCasinoAction, casinoOverviewAction, releaseFromCasinoAction } from "../actions";
import type { SeatingOverview } from "../queries";
import { ALLOCATION_COLORS, casinoMove, planColors } from "../view-model";
import { AllocationBadge, INFO_TONES } from "./allocation-badge";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

const FAILED_MESSAGE = "İşlem tamamlanamadı";

/** Onay kutusu 16 px'tir; çevresindeki etiket dokunma hedefini 44 px yapar. */
const checkboxClass = "border-muted-foreground";

/** Casino tahsis ekranı: özet, renkli plan, masa listesi ve "Casino'ya ayır" / "Serbest bırak" işlemleri. */
export function CasinoAllocation({
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

  const queryKey = useMemo(() => [...realtimeKeys.seats(eventId), "casino"] as const, [eventId]);
  const { data } = useQuery({
    queryKey,
    queryFn: async () => unwrap(await casinoOverviewAction({ eventId })),
    initialData: initial,
  });

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const { tables, plan } = data;
  const moves = useMemo(() => new Map(tables.map((t) => [t.id, casinoMove(t)] as const)), [tables]);
  const disabledIds = useMemo(() => tables.filter((t) => moves.get(t.id) === null).map((t) => t.id), [tables, moves]);
  const colors = useMemo(() => planColors(tables, "allocation"), [tables]);

  // Veri yenilenince artık işlem yapılamayan masalar seçimden düşer.
  const selectedTables = useMemo(
    () => tables.filter((t) => selectedIds.has(t.id) && moves.get(t.id) !== null),
    [tables, selectedIds, moves],
  );
  const selectedSet = useMemo(() => new Set(selectedTables.map((t) => t.id)), [selectedTables]);
  const toAllocate = useMemo(() => selectedTables.filter((t) => moves.get(t.id) === "allocate"), [selectedTables, moves]);
  const toRelease = useMemo(() => selectedTables.filter((t) => moves.get(t.id) === "release"), [selectedTables, moves]);
  const pendingTables = useMemo(() => tables.filter((t) => t.allocation === "pending"), [tables]);

  const summary = useMemo(() => {
    const casino = tables.filter((t) => t.allocation === "casino");
    const count = (allocation: (typeof TABLE_ALLOCATIONS)[number]) => tables.filter((t) => t.allocation === allocation).length;
    return {
      casinoTables: casino.length,
      casinoSeats: casino.reduce((sum, t) => sum + t.capacity, 0),
      pending: count("pending"),
      online: count("online"),
      closed: count("closed"),
    };
  }, [tables]);

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  /** Eylemi çalıştırır; sunucu mesajı (uygunsuz masa etiketleriyle) toast'ta ve kalıcı uyarıda aynen gösterilir. */
  async function perform(
    call: () => Promise<ActionResult<{ updated: number }>>,
    successText: (updated: number) => string,
    processedIds: readonly string[],
  ): Promise<void> {
    setBusy(true);
    setNotice(null);
    setLastError(null);
    try {
      const result = await call();
      if (result.ok) {
        const text = successText(result.data.updated);
        setNotice(text);
        // Yalnızca işlem gören masalar seçimden çıkar; diğerleri seçili kalır.
        setSelectedIds((prev) => new Set([...prev].filter((id) => !processedIds.includes(id))));
        toast.success(text);
        await refresh();
        return;
      }
      setLastError(result.message);
      toast.error(result.message);
    } catch {
      setNotice(null);
      setLastError(FAILED_MESSAGE);
      toast.error(FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const allocate = () =>
    perform(
      () => allocateToCasinoAction({ eventId, tableIds: toAllocate.map((t) => t.id) }),
      (n) => `${n} masa Casino'ya ayrıldı`,
      toAllocate.map((t) => t.id),
    );
  const release = () =>
    perform(
      () => releaseFromCasinoAction({ eventId, tableIds: toRelease.map((t) => t.id) }),
      (n) => `${n} masa serbest bırakıldı`,
      toRelease.map((t) => t.id),
    );

  const toggle = (tableId: string) => {
    if (moves.get(tableId) === null) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(tableId)) next.add(tableId);
      return next;
    });
  };

  return (
    <div className="min-w-0 space-y-6">
      <section aria-label="Özet" className="rounded-xl border border-border bg-card p-4 text-card-foreground">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <li className="text-sm">
            <span className="font-semibold">Casino</span>: {summary.casinoTables} masa · {summary.casinoSeats} kişilik
          </li>
          <li className="text-sm">
            <span className="font-semibold">Beklemede</span>: {summary.pending} masa
          </li>
          <li className="text-sm">
            <span className="font-semibold">Online satış</span>: {summary.online} masa
          </li>
          <li className="text-sm">
            <span className="font-semibold">Kapalı</span>: {summary.closed} masa
          </li>
        </ul>
      </section>

      <section
        aria-label="Alan planı"
        className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
      >
        <ul aria-label="Renk açıklaması" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {TABLE_ALLOCATIONS.map((a) => (
            <li key={a} className="flex items-center gap-1.5 text-sm">
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded-sm border border-foreground/60"
                style={{ backgroundColor: ALLOCATION_COLORS[a] }}
              />
              {ALLOCATION_LABELS[a]}
            </li>
          ))}
        </ul>
        <FloorPlanSwitcher
          plan={plan}
          colorByTable={colors}
          disabledIds={disabledIds}
          outlinedIds={selectedTables.map((t) => t.id)}
          onSelect={canEdit ? toggle : undefined}
          onSelectMany={
            canEdit ? (ids) => setSelectedIds(new Set(ids.filter((id) => moves.get(id) !== null))) : undefined
          }
          height={420}
          ariaLabel="Masa alan planı"
        />
      </section>

      {canEdit ? (
        <section
          aria-label="Toplu işlemler"
          className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
        >
          <p className="text-sm font-semibold">
            {selectedTables.length} masa seçili
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy || pendingTables.length === 0}
              onClick={() => setSelectedIds(new Set(pendingTables.map((t) => t.id)))}
            >
              Beklemedeki tüm masaları seç
            </Button>
            {selectedTables.length > 0 ? (
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setSelectedIds(new Set())}>
                Seçimi temizle
              </Button>
            ) : null}
            {toAllocate.length > 0 ? (
              <Button type="button" className="h-11" disabled={busy} onClick={() => void allocate()}>
                Casino&apos;ya ayır
              </Button>
            ) : null}
            {toRelease.length > 0 ? (
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setConfirmRelease(true)}>
                Serbest bırak
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
          {notice}
        </p>
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
        {tables.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Bu etkinlikte henüz masa yok.</p>
        ) : (
          <Table aria-label="Masalar">
            <TableHeader>
              <TableRow>
                {canEdit ? (
                  <TableHead className="w-12">
                    <span className="sr-only">Seç</span>
                  </TableHead>
                ) : null}
                <TableHead>Masa</TableHead>
                <TableHead>Kapasite</TableHead>
                <TableHead>Tahsis</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id} data-state={selectedSet.has(table.id) ? "selected" : undefined}>
                  {canEdit ? (
                    <TableCell>
                      {moves.get(table.id) !== null ? (
                        <label className="flex size-11 cursor-pointer items-center justify-center">
                          <Checkbox
                            aria-label={`${table.label} masasını seç`}
                            className={checkboxClass}
                            checked={selectedSet.has(table.id)}
                            onCheckedChange={() => toggle(table.id)}
                          />
                        </label>
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">{table.label}</TableCell>
                  <TableCell>{table.capacity}</TableCell>
                  <TableCell>
                    <AllocationBadge allocation={table.allocation} />
                  </TableCell>
                  <TableCell>
                    {table.hasActiveReservation ? (
                      <Badge variant="outline" className={cn(INFO_TONES.reserved)}>
                        Rezervasyonlu
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Boş</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <ConfirmDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title="Masalar serbest bırakılsın mı?"
        description={`Seçili ${toRelease.length} masa serbest bırakılsın mı? Entertainment bu masaları satışa açabilir.`}
        confirmText="Serbest bırak"
        cancelText="Vazgeç"
        variant="warning"
        loading={busy}
        onConfirm={() => {
          setConfirmRelease(false);
          void release();
        }}
      />
    </div>
  );
}
