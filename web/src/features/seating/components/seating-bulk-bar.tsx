"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SALE_CATEGORIES, SALE_CATEGORY_LABELS, type SaleCategory } from "@/domain/seating";
import { cn } from "@/lib/utils";
import type { SeatingTable } from "../queries";
import type { SaleSettings } from "../settings-service";
import { parseSellableInput, saleMoveBlocker, type SaleMove } from "../view-model";

const MOVES: { move: SaleMove; label: string }[] = [
  { move: "online", label: "Satışa aç" },
  { move: "closed", label: "Satışı kapat" },
  { move: "pending", label: "Beklemeye al" },
];

/** Önden bilgi: seçimde bu geçişe engel olan masa sayısı ve nedenleri (karar sunucunundur). */
function blockedSummary(selected: readonly SeatingTable[], move: SaleMove, settings: Pick<SaleSettings, "locaOnline">) {
  const reasons = new Set<string>();
  let count = 0;
  for (const table of selected) {
    const reason = saleMoveBlocker(table, move, settings);
    if (reason) {
      count += 1;
      reasons.add(reason);
    }
  }
  return count === 0 ? null : { count, reason: [...reasons].join(", ") };
}

export function SeatingBulkBar({
  selected,
  settings,
  pending,
  onClassify,
  onMove,
  onClear,
}: {
  selected: readonly SeatingTable[];
  settings: Pick<SaleSettings, "locaOnline">;
  pending: boolean;
  onClassify: (patch: { category?: SaleCategory; sellableSeats?: number | null }) => void;
  onMove: (move: SaleMove) => void;
  onClear: () => void;
}) {
  const [category, setCategory] = useState<SaleCategory | "">("");
  const [seats, setSeats] = useState("");
  const minCapacity = Math.min(...selected.map((t) => t.capacity));
  const parsedSeats = seats.trim() === "" ? null : parseSellableInput(seats, minCapacity);
  const seatsError = parsedSeats && !parsedSeats.ok ? parsedSeats.message : null;
  const seatsValue = parsedSeats && parsedSeats.ok && parsedSeats.value !== null ? parsedSeats.value : null;

  return (
    <section
      aria-label="Toplu işlemler"
      className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm font-semibold">
          {selected.length} masa seçili
        </p>
        <Button type="button" variant="outline" className="h-11" onClick={onClear}>
          Seçimi temizle
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bulk-category">Kategori</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={category} onValueChange={(v) => setCategory(v as SaleCategory)}>
              <SelectTrigger id="bulk-category" className="w-full data-[size=default]:h-11 sm:w-44">
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                {SALE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {SALE_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              className="h-11"
              disabled={pending || category === ""}
              onClick={() => category && onClassify({ category })}
            >
              Kategoriyi uygula
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bulk-seats">Satılabilir sandalye</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="bulk-seats"
              inputMode="numeric"
              placeholder="Sayı"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              aria-invalid={seatsError ? true : undefined}
              aria-describedby="bulk-seats-hint"
              className="h-11 w-full sm:w-32"
            />
            <Button
              type="button"
              className="h-11"
              disabled={pending || seatsValue === null}
              onClick={() => seatsValue !== null && onClassify({ sellableSeats: seatsValue })}
            >
              Sayıyı uygula
            </Button>
          </div>
          <p id="bulk-seats-hint" className={cn("text-sm", seatsError ? "text-destructive" : "text-muted-foreground")}>
            {seatsError ?? `1 ile ${minCapacity} arasında bir sayı girin.`}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            disabled={pending}
            onClick={() => onClassify({ sellableSeats: null })}
          >
            Tüm sandalyeleri satılabilir yap
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MOVES.map(({ move, label }) => {
          const blocked = blockedSummary(selected, move, settings);
          const hintId = `bulk-move-${move}-hint`;
          return (
            <div key={move} className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={pending || blocked !== null}
                aria-describedby={blocked ? hintId : undefined}
                onClick={() => onMove(move)}
              >
                {label}
              </Button>
              {blocked ? (
                <p id={hintId} className="text-sm text-muted-foreground">
                  {blocked.count} masa atlanamaz: {blocked.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
