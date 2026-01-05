"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { SpacingState } from "../types";

interface SpacingModalProps {
  spacingState: SpacingState;
  onSpacingChange: (spacing: number) => void;
  onApply: () => void;
  onClose: () => void;
}

export function SpacingModal({
  spacingState,
  onSpacingChange,
  onApply,
  onClose,
}: SpacingModalProps) {
  if (!spacingState.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg p-6 w-80 border border-slate-700 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Aralık Ayarla</h3>
        <p className="text-sm text-slate-400 mb-4">
          {spacingState.targetIds.length} seçili masa arasındaki mesafeyi
          ayarlayın
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-slate-300 mb-2">
              <span>Aralık</span>
              <span className="font-mono">{spacingState.currentSpacing}px</span>
            </div>
            <Slider
              value={[spacingState.currentSpacing]}
              onValueChange={(value) => onSpacingChange(value[0])}
              min={0}
              max={40}
              step={2}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0px</span>
              <span>40px</span>
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2">
            {[0, 4, 8, 16, 24].map((preset) => (
              <button
                key={preset}
                onClick={() => onSpacingChange(preset)}
                className={`flex-1 py-1.5 text-xs rounded ${
                  spacingState.currentSpacing === preset
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {preset}px
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-slate-600"
          >
            İptal
          </Button>
          <Button
            onClick={onApply}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Uygula
          </Button>
        </div>
      </div>
    </div>
  );
}
