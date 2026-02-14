"use client";

import { X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CapacityEditState } from "../types";

interface CapacityEditModalProps {
  capacityState: CapacityEditState;
  onCapacityChange: (capacity: number) => void;
  onApply: (capacity: number) => void;
  onClose: () => void;
}

const CAPACITY_PRESETS = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
  { value: 10, label: "10" },
  { value: 12, label: "12" },
  { value: 16, label: "16" },
  { value: 20, label: "20" },
  { value: 24, label: "24" },
];

export function CapacityEditModal({
  capacityState,
  onCapacityChange,
  onApply,
  onClose,
}: CapacityEditModalProps) {
  if (!capacityState.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white">
            Kişi Sayısı Değiştir ({capacityState.targetIds.length} masa)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Capacity Preview */}
          <div className="flex items-center justify-center gap-3 py-4 bg-slate-900 rounded-lg">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="text-2xl font-bold text-white">
              {capacityState.currentCapacity}
            </span>
            <span className="text-sm text-slate-400">kişi</span>
          </div>

          {/* Preset Options */}
          <div className="grid grid-cols-3 gap-2">
            {CAPACITY_PRESETS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onCapacityChange(opt.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  capacityState.currentCapacity === opt.value
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {opt.label} kişi
              </button>
            ))}
          </div>

          {/* Custom Slider */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Özel Kapasite</label>
            <input
              type="range"
              min={1}
              max={50}
              value={capacityState.currentCapacity}
              onChange={(e) => onCapacityChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1</span>
              <span className="text-emerald-400 font-medium">
                {capacityState.currentCapacity} kişi
              </span>
              <span>50</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            İptal
          </Button>
          <Button
            size="sm"
            onClick={() => onApply(capacityState.currentCapacity)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Uygula
          </Button>
        </div>
      </div>
    </div>
  );
}
