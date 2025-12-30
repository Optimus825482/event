"use client";

/**
 * Table Locator Modal - Masa konumu gösterici
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import { useRef, useEffect, useState } from "react";
import { X, MapPin, Navigation, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TableLocation, VenueLayout } from "@/store/check-in-store";

interface TableLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableLocation: TableLocation;
  venueLayout: VenueLayout;
}

export function TableLocatorModal({
  isOpen,
  onClose,
  tableLocation,
  venueLayout,
}: TableLocatorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas boyutları
    const containerWidth = canvas.parentElement?.clientWidth || 300;
    const containerHeight = 300;
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Venue boyutları
    const venueWidth = venueLayout.width || 800;
    const venueHeight = venueLayout.height || 600;

    // Scale hesapla
    const scaleX = (containerWidth - 40) / venueWidth;
    const scaleY = (containerHeight - 40) / venueHeight;
    const baseScale = Math.min(scaleX, scaleY) * scale;

    // Offset hesapla (merkeze al)
    const offsetX = (containerWidth - venueWidth * baseScale) / 2 + offset.x;
    const offsetY = (containerHeight - venueHeight * baseScale) / 2 + offset.y;

    // Clear canvas
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    const gridSize = 50 * baseScale;
    for (let x = offsetX % gridSize; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offsetY % gridSize; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw tables
    venueLayout.tables?.forEach((table) => {
      const x = table.x * baseScale + offsetX;
      const y = table.y * baseScale + offsetY;
      const width = (table.width || 60) * baseScale;
      const height = (table.height || 60) * baseScale;
      const isTarget = table.id === tableLocation.tableId;

      // Table shape
      ctx.beginPath();
      if (table.shape === "circle") {
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
      } else {
        ctx.roundRect(x, y, width, height, 4);
      }

      // Fill
      if (isTarget) {
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;
      }
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = isTarget ? "#ffffff" : "#94a3b8";
      ctx.font = `${isTarget ? "bold " : ""}${Math.max(
        10,
        12 * baseScale
      )}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(table.label, x + width / 2, y + height / 2);

      // Target indicator (pulsing circle)
      if (isTarget) {
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2 + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw target marker
    const targetTable = venueLayout.tables?.find(
      (t) => t.id === tableLocation.tableId
    );
    if (targetTable) {
      const x = targetTable.x * baseScale + offsetX;
      const y = targetTable.y * baseScale + offsetY;
      const width = (targetTable.width || 60) * baseScale;

      // Arrow pointing to table
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y - 20);
      ctx.lineTo(x + width / 2 - 8, y - 35);
      ctx.lineTo(x + width / 2 + 8, y - 35);
      ctx.closePath();
      ctx.fill();
    }
  }, [isOpen, venueLayout, tableLocation, scale, offset]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 2));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Masa Konumu</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Table Info */}
        <div className="p-4 bg-green-500/10 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-white">
                Masa {tableLocation.label}
              </div>
              {tableLocation.section && (
                <div className="text-sm text-slate-400">
                  {tableLocation.section} Bölümü
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-300">
            {tableLocation.directionText}
          </div>
        </div>

        {/* Canvas */}
        <div className="relative p-4">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{ height: 300 }}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <Button
            onClick={onClose}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Tamam
          </Button>
        </div>
      </div>
    </div>
  );
}
