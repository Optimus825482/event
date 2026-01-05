"use client";

import {
  MousePointer2,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Magnet,
  Grid3X3,
  Settings,
  BoxSelect,
  Lock,
  Unlock,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanvasTool, TableType, PlacedTable } from "../types";
import { TABLE_TYPE_CONFIG } from "../constants";

interface VenueToolbarProps {
  activeTool: CanvasTool;
  setActiveTool: (tool: CanvasTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  gridSnap: boolean;
  onToggleGridSnap: () => void;
  showGuideLines: boolean;
  onToggleGuideLines: () => void;
  onAutoAlign: () => void;
  selectedAssignType: TableType;
  setSelectedAssignType: (type: TableType) => void;
  selectedItems: string[];
  onAssignSelectedType: (type: TableType) => void;
  tableStats: {
    stats: Record<TableType, { count: number; capacity: number }>;
    totalCapacity: number;
  };
  placedTables: PlacedTable[];
  // Çoklu seçim işlemleri
  onLockSelected?: () => void;
  onUnlockSelected?: () => void;
  onDeleteSelected?: () => void;
  onSpacingSelected?: () => void;
}

export function VenueToolbar({
  activeTool,
  setActiveTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  isFullscreen,
  onToggleFullscreen,
  gridSnap,
  onToggleGridSnap,
  showGuideLines,
  onToggleGuideLines,
  onAutoAlign,
  selectedAssignType,
  setSelectedAssignType,
  selectedItems,
  onAssignSelectedType,
  tableStats,
  placedTables,
  onLockSelected,
  onUnlockSelected,
  onDeleteSelected,
  onSpacingSelected,
}: VenueToolbarProps) {
  return (
    <div className="w-64 space-y-4">
      {/* Tools */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <h3 className="text-sm font-medium text-white mb-3">Araçlar</h3>
        <div className="grid grid-cols-4 gap-2">
          <Button
            size="sm"
            variant={activeTool === "select" ? "default" : "outline"}
            onClick={() => setActiveTool("select")}
            className="p-2"
            title="Seçim (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={activeTool === "lasso" ? "default" : "outline"}
            onClick={() => setActiveTool("lasso")}
            className="p-2"
            title="Lasso Seçim (L)"
          >
            <BoxSelect className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={activeTool === "pan" ? "default" : "outline"}
            onClick={() => setActiveTool("pan")}
            className="p-2"
            title="Kaydır (H)"
          >
            <Hand className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2"
            title="Geri Al (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2"
            title="Yinele (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onZoomOut}
            className="p-2"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onZoomIn}
            className="p-2"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onResetView}
            className="p-2"
            title="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleFullscreen}
            className="p-2"
            title="Tam Ekran"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant={gridSnap ? "default" : "outline"}
            onClick={onToggleGridSnap}
            className="flex-1 text-xs"
          >
            <Magnet className="w-3 h-3 mr-1" />
            Snap
          </Button>
          <Button
            size="sm"
            variant={showGuideLines ? "default" : "outline"}
            onClick={onToggleGuideLines}
            className="flex-1 text-xs"
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            Grid
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAutoAlign}
          className="w-full mt-2 text-xs"
          title={
            selectedItems.length > 0
              ? `${selectedItems.length} seçili masayı hizala`
              : "Tüm masaları hizala"
          }
        >
          <Settings className="w-3 h-3 mr-1" />
          {selectedItems.length > 0
            ? `Seçilileri Hizala (${selectedItems.length})`
            : "Otomatik Hizala"}
        </Button>
      </div>

      {/* Selection Actions - Seçili element varsa göster */}
      {selectedItems.length > 0 && (
        <div className="bg-slate-800 border border-amber-600/50 rounded-lg p-3">
          <h3 className="text-sm font-medium text-amber-400 mb-3">
            Seçili: {selectedItems.length} element
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onLockSelected}
              className="text-xs"
              title="Seçilileri Sabitle"
            >
              <Lock className="w-3 h-3 mr-1" />
              Sabitle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onUnlockSelected}
              className="text-xs"
              title="Seçililerin Kilidini Aç"
            >
              <Unlock className="w-3 h-3 mr-1" />
              Kilidi Aç
            </Button>
          </div>
          {/* Aralık Ayarla - En az 2 element seçili olmalı */}
          {selectedItems.length >= 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSpacingSelected}
              className="w-full mt-2 text-xs"
              title="Seçili masalar arasındaki aralığı ayarla"
            >
              <ArrowLeftRight className="w-3 h-3 mr-1" />
              Aralık Ayarla
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={onDeleteSelected}
            className="w-full mt-2 text-xs"
            title="Seçilileri Sil (Delete)"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Seçilileri Sil
          </Button>
        </div>
      )}

      {/* Stats - ÜST */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <h3 className="text-sm font-medium text-white mb-3">İstatistikler</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Toplam Masa:</span>
            <span className="font-medium">
              {placedTables.filter((t) => !t.isLoca).length}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Toplam Loca:</span>
            <span className="font-medium">
              {placedTables.filter((t) => t.isLoca).length}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Toplam Kapasite:</span>
            <span className="font-medium text-emerald-400">
              {tableStats.totalCapacity}
            </span>
          </div>
          <div className="flex justify-between text-amber-400">
            <span>Atanmamış:</span>
            <span className="font-medium">
              {tableStats.stats.unassigned.count}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Type Assignment - ALT */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <h3 className="text-sm font-medium text-white mb-3">Hızlı Tip Atama</h3>
        <div className="space-y-2">
          {(
            Object.entries(TABLE_TYPE_CONFIG) as [
              TableType,
              typeof TABLE_TYPE_CONFIG.vip
            ][]
          )
            .filter(([key]) => key !== "unassigned")
            .map(([type, config]) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedAssignType(type);
                  if (selectedItems.length > 0) onAssignSelectedType(type);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedAssignType === type
                    ? "bg-slate-700 ring-2 ring-blue-500"
                    : "bg-slate-700/50 hover:bg-slate-700"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-white">{config.label}</span>
                <span className="ml-auto text-slate-400 text-xs">
                  {tableStats.stats[type].count}
                </span>
              </button>
            ))}
        </div>
        {selectedItems.length > 0 && (
          <p className="text-xs text-slate-400 mt-2 text-center">
            {selectedItems.length} element seçili - tıklayarak ata
          </p>
        )}
      </div>
    </div>
  );
}
