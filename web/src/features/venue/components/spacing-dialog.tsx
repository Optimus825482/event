"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SPACING_MAX, SPACING_MIN, SPACING_PRESETS } from "../editor/arrange";
import { runSpacing, selectedTableKeys, type Notify } from "./editor-commands";
import { useEditorStore } from "./editor-context";

/** "Aralık Ayarla": seçili masalar arasındaki boşluk (0–40 px). */
export function SpacingDialog({ onClose, notify }: { onClose: () => void; notify: Notify }) {
  const store = useEditorStore();
  const [gap, setGap] = useState(16);
  const sliderId = useId();
  const count = selectedTableKeys(store).length;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Aralık Ayarla</DialogTitle>
          <DialogDescription>{`${count} seçili masa arasındaki mesafeyi ayarlayın`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label htmlFor={sliderId} className="flex justify-between text-sm">
            <span>Aralık</span>
            <span className="tabular-nums text-blue-500">{`${gap}px`}</span>
          </label>
          <input
            id={sliderId}
            type="range"
            min={SPACING_MIN}
            max={SPACING_MAX}
            step={2}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Hazır aralıklar">
            {SPACING_PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={gap === p ? "default" : "outline"}
                aria-pressed={gap === p}
                className={cn(gap === p && "bg-blue-600 text-white hover:bg-blue-700")}
                onClick={() => setGap(p)}
              >
                {`${p}px`}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={count < 2}
            onClick={() => {
              runSpacing(store, gap, notify);
              onClose();
            }}
          >
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
