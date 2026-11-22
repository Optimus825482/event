"use client";

import { ChevronLeft, ChevronRight, Circle, Minus, Plus, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Point } from "../editor/geometry";
import { BULK_ADD_MAX } from "../editor/placement";
import { MAX_TABLE_CAPACITY, MAX_TABLES } from "../schemas";
import type { Notify } from "./editor-commands";
import { useEditor, useEditorStore } from "./editor-context";

export type AddRequest = { kind: "table" | "loca"; start?: Point };

const CAPACITY_PRESETS = [4, 6, 8, 10, 12, 14, 16, 20] as const;
const CAPACITY_COLORS: Record<number, string> = {
  4: "#22c55e",
  6: "#3b82f6",
  8: "#6366f1",
  10: "#8b5cf6",
  12: "#a855f7",
  14: "#d946ef",
  16: "#ec4899",
  20: "#f43f5e",
};
export const FLOOR_OPTIONS = [
  { value: 1, title: "Zemin Kat", hint: "Ana salon seviyesi" },
  { value: 2, title: "2. Kat", hint: "Balkon / Galeri" },
  { value: 3, title: "3. Kat", hint: "Üst balkon" },
] as const;

type Step = "capacity" | "count" | "floor";

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

function CapacityStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">{"Masa kaç kişilik?"}</legend>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Kişi sayısı">
        {CAPACITY_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-2 text-sm",
              value === c ? "border-2 border-blue-500" : "border-border hover:bg-muted",
            )}
          >
            <span className="size-3 rounded-full" style={{ backgroundColor: CAPACITY_COLORS[c] }} aria-hidden />
            <span className="text-lg font-semibold tabular-nums">{c}</span>
            <span className="text-xs text-muted-foreground">kişi</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        Özel:
        <Input
          type="number"
          min={1}
          max={MAX_TABLE_CAPACITY}
          value={value}
          onChange={(e) => onChange(clampInt(e.target.valueAsNumber, 1, MAX_TABLE_CAPACITY))}
          className="w-24"
          aria-label="Özel kişi sayısı"
        />
      </label>
    </fieldset>
  );
}

function CountStep({ kind, value, max, onChange }: { kind: AddRequest["kind"]; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{kind === "loca" ? "Kaç adet loca eklemek istiyorsunuz?" : "Kaç adet masa eklemek istiyorsunuz?"}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Azalt" disabled={value <= 1} onClick={() => onChange(value - 1)}>
          <Minus className="size-4" />
        </Button>
        <Input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(clampInt(e.target.valueAsNumber, 1, max))}
          className="w-24 text-center"
          aria-label="Adet"
        />
        <Button type="button" variant="outline" size="icon" aria-label="Artır" disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{`1. satırdan başlayarak yerleştirilecek (max ${max})`}</p>
    </div>
  );
}

function FloorStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Localar hangi katta?</legend>
      <div role="radiogroup" aria-label="Kat" className="space-y-2">
        {FLOOR_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={value === f.value}
            onClick={() => onChange(f.value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md border p-2 text-left",
              value === f.value ? "border-2 border-pink-500" : "border-border hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-md text-sm font-bold",
                value === f.value ? "bg-pink-500 text-white" : "bg-muted",
              )}
            >
              {f.value}
            </span>
            <span>
              <span className="block text-sm font-medium">{f.title}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** "Masa Ekle" (kişi → adet) ve "Loca Ekle" (adet → kat → kişi) sihirbazı; ekleme tek geri al adımıdır. */
export function AddElementsDialog({ request, onClose, notify }: { request: AddRequest; onClose: () => void; notify: Notify }) {
  const store = useEditorStore();
  const existing = useEditor((s) => s.tables.length);
  const isLoca = request.kind === "loca";
  const steps: Step[] = isLoca ? ["count", "floor", "capacity"] : ["capacity", "count"];
  const [index, setIndex] = useState(0);
  const [capacity, setCapacity] = useState(isLoca ? 6 : 10);
  const [count, setCount] = useState(1);
  const [floor, setFloor] = useState(isLoca ? 2 : 1);
  const max = Math.max(0, Math.min(BULK_ADD_MAX, MAX_TABLES - existing));
  const step = steps[index] ?? "capacity";
  const last = index === steps.length - 1;
  const noun = isLoca ? "Loca" : "Masa";
  const floorTitle = FLOOR_OPTIONS.find((f) => f.value === floor)?.title ?? `${floor}. Kat`;

  function add() {
    const wanted = Math.min(count, max);
    const r = store.getState().addTablesBatch({ count: wanted, capacity, isLoca, floor, tableTypeId: null, start: request.start });
    if (r.added < wanted) notify("error", `Yeterli alan yok! ${r.added}/${wanted} element yerleştirildi.`);
    else notify("ok", `${r.added} ${isLoca ? "loca" : "masa"} eklendi.`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoca ? <Square className="size-4 text-pink-400" aria-hidden /> : <Circle className="size-4 text-blue-400" aria-hidden />}
            {`${noun} Ekle`}
            <span className="ml-auto pr-6 text-xs font-normal text-muted-foreground">{`Adım ${index + 1}/${steps.length}`}</span>
          </DialogTitle>
        </DialogHeader>
        {max === 0 ? (
          <p role="alert" className="text-sm text-destructive">{`En fazla ${MAX_TABLES} masa olabilir.`}</p>
        ) : step === "capacity" ? (
          <CapacityStep value={capacity} onChange={setCapacity} />
        ) : step === "count" ? (
          <CountStep kind={request.kind} value={Math.min(count, max)} max={max} onChange={setCount} />
        ) : (
          <FloorStep value={floor} onChange={setFloor} />
        )}
        {last && max > 0 ? (
          <div className="space-y-1 rounded-md bg-muted p-3 text-sm" aria-label="Özet">
            <p className="font-medium">Özet:</p>
            <p>{`${Math.min(count, max)} adet ${noun} (${capacity} kişilik)`}</p>
            {isLoca ? <p className="text-pink-500">{`Kat: ${floorTitle}`}</p> : null}
            <p>
              Toplam kapasite: <strong>{`${Math.min(count, max) * capacity} kişi`}</strong>
            </p>
          </div>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {index > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setIndex(index - 1)}>
              <ChevronLeft className="size-4" /> Geri
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            {last ? (
              <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={max === 0} onClick={add}>
                Ekle
              </Button>
            ) : (
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setIndex(index + 1)}>
                İleri <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
