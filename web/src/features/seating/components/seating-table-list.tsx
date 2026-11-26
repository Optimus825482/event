"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SALE_CATEGORIES, SALE_CATEGORY_LABELS, type SaleCategory } from "@/domain/seating";
import { cn } from "@/lib/utils";
import type { SeatingTable } from "../queries";
import { parseSellableInput } from "../view-model";
import { AllocationBadge, INFO_TONES } from "./allocation-badge";

export type ClassifyPatch = { category?: SaleCategory; sellableSeats?: number | null };

/** Onay kutusu 16 px'tir; çevresindeki etiket dokunma hedefini 44 px yapar. */
const checkboxClass = "border-muted-foreground";

function SellableCell({
  table,
  disabled,
  onCommit,
  onInvalid,
}: {
  table: SeatingTable;
  disabled: boolean;
  onCommit: (patch: ClassifyPatch) => Promise<boolean>;
  onInvalid: () => void;
}) {
  const [draft, setDraft] = useState(table.sellableSeats === null ? "" : String(table.sellableSeats));
  const [error, setError] = useState<string | null>(null);
  const errorId = `sellable-${table.id}-error`;
  const inFlight = useRef(false);

  async function commit() {
    const parsed = parseSellableInput(draft, table.capacity);
    if (!parsed.ok) {
      setError(parsed.message);
      onInvalid();
      return;
    }
    setError(null);
    if (parsed.value === table.sellableSeats || inFlight.current) return;
    inFlight.current = true;
    let ok = false;
    try {
      ok = await onCommit({ sellableSeats: parsed.value });
    } catch {
      ok = false;
    } finally {
      inFlight.current = false;
    }
    // Reddedilirse alan sunucudaki değere döner; başarıda yeni değer yenilenen veriyle gelir.
    if (!ok) setDraft(table.sellableSeats === null ? "" : String(table.sellableSeats));
  }

  return (
    <div className="space-y-1">
      <Input
        inputMode="numeric"
        placeholder="Tümü"
        aria-label={`${table.label} satılabilir sandalye`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
        }}
        className="h-11 w-24"
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SeatingTableList({
  tables,
  selectedIds,
  canEdit,
  busy,
  onToggle,
  onToggleAll,
  onClassifyOne,
  onInvalidInput,
}: {
  tables: readonly SeatingTable[];
  selectedIds: ReadonlySet<string>;
  canEdit: boolean;
  busy: boolean;
  onToggle: (tableId: string) => void;
  onToggleAll: (checked: boolean) => void;
  onClassifyOne: (tableId: string, patch: ClassifyPatch) => Promise<boolean>;
  /** Satır içi alanda doğrulama hatası olunca eski sunucu hatasını temizlemek için. */
  onInvalidInput: () => void;
}) {
  const allSelected = tables.length > 0 && tables.every((t) => selectedIds.has(t.id));
  const someSelected = !allSelected && tables.some((t) => selectedIds.has(t.id));

  if (tables.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Bu etkinlikte henüz masa yok.</p>;
  }

  return (
    <Table aria-label="Masalar">
      <TableHeader>
        <TableRow>
          {canEdit ? (
            <TableHead className="w-12">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap">
                <Checkbox
                  aria-label="Tümünü seç"
                  className={checkboxClass}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => onToggleAll(v === true)}
                />
                <span className="text-xs font-medium">Tümünü seç</span>
              </label>
            </TableHead>
          ) : null}
          <TableHead>Masa</TableHead>
          <TableHead>Kapasite</TableHead>
          <TableHead>Satılabilir</TableHead>
          <TableHead>Kategori</TableHead>
          <TableHead>Tahsis</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tables.map((table) => (
          <TableRow key={table.id} data-state={selectedIds.has(table.id) ? "selected" : undefined}>
            {canEdit ? (
              <TableCell>
                <label className="flex size-11 cursor-pointer items-center justify-center">
                  <Checkbox
                    aria-label={`${table.label} masasını seç`}
                    className={checkboxClass}
                    checked={selectedIds.has(table.id)}
                    onCheckedChange={() => onToggle(table.id)}
                  />
                </label>
              </TableCell>
            ) : null}
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{table.label}</span>
                {table.isLoca ? (
                  <Badge variant="outline" className={cn(INFO_TONES.loca)}>
                    Loca
                  </Badge>
                ) : null}
                {table.hasActiveReservation ? (
                  <Badge variant="outline" className={cn(INFO_TONES.reserved)}>
                    Rezervasyonlu
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell>{table.capacity}</TableCell>
            <TableCell>
              {canEdit ? (
                <SellableCell
                  key={`${table.id}:${table.sellableSeats ?? "null"}`}
                  table={table}
                  disabled={busy}
                  onCommit={(patch) => onClassifyOne(table.id, patch)}
                  onInvalid={onInvalidInput}
                />
              ) : (
                table.effectiveSellable
              )}
            </TableCell>
            <TableCell>
              {canEdit ? (
                <Select
                  value={table.category}
                  disabled={busy}
                  onValueChange={(v) => {
                    if (v !== table.category) void onClassifyOne(table.id, { category: v as SaleCategory });
                  }}
                >
                  <SelectTrigger aria-label={`${table.label} kategorisi`} className="w-36 data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SALE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                SALE_CATEGORY_LABELS[table.category]
              )}
            </TableCell>
            <TableCell>
              <AllocationBadge allocation={table.allocation} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
