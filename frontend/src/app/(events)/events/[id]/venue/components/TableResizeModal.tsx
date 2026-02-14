"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TableResizeState } from "../types";
import { DEFAULT_TABLE_SIZE } from "../constants";

interface TableResizeModalProps {
  resizeState: TableResizeState;
  onSizeChange: (size: number) => void;
  onApply: (size: number) => void;
  onClose: () => void;
}

const SIZE_OPTIONS = [
  { value: 24, label: "XS", desc: "24px" },
  { value: 32, label: "S", desc: "32px" },
  { value: 40, label: "M", desc: "40px (Varsayılan)" },
  { value: 48, label: "L", desc: "48px" },
  { value: 56, label: "XL", desc: "56px" },
  { value: 64, label: "XXL", desc: "64px" },
];

export function TableResizeModal({
  resizeState,
  onSizeChange,
  onApply,
  onClose,
}: TableResizeModalProps) {
  if (!resizeState.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white">
            Masa Boyutlandır ({resizeState.targetIds.length} masa)
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
          {/* Size Preview */}
          <div className="flex items-center justify-center py-4 bg-slate-900 rounded-lg">
            <div
              className="rounded-full bg-blue-500 border-2 border-blue-400 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{
                width: resizeState.currentSize,
                height: resizeState.currentSize,
              }}
            >
              {resizeState.currentSize}
            </div>
          </div>

          {/* Size Options */}
          <div className="grid grid-cols-3 gap-2">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSizeChange(opt.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  resizeState.currentSize === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Custom Slider */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Özel Boyut</label>
            <input
              type="range"
              min={20}
              max={80}
              value={resizeState.currentSize}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>20px</span>
              <span className="text-blue-400 font-medium">
                {resizeState.currentSize}px
              </span>
              <span>80px</span>
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
            onClick={() => onApply(resizeState.currentSize)}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Uygula
          </Button>
        </div>
      </div>
    </div>
  );
}
