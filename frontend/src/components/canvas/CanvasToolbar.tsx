"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MousePointer2,
  Hand,
  Grid3X3,
  Eraser,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Pencil,
  Square,
  Music,
  DoorOpen,
  Wine,
  Disc,
  Bath,
  Tag,
  LayoutGrid,
  Undo2,
  Redo2,
  HelpCircle,
  X,
} from "lucide-react";

// Kullanılabilir etiketler
const WALL_LABELS = [
  { id: "stage", label: "Sahne", icon: Music, color: "#3b82f6" },
  { id: "bar", label: "Bar", icon: Wine, color: "#f97316" },
  { id: "entrance", label: "Giriş", icon: DoorOpen, color: "#22c55e" },
  { id: "exit", label: "Çıkış", icon: DoorOpen, color: "#ef4444" },
  { id: "dj", label: "DJ", icon: Disc, color: "#8b5cf6" },
  { id: "wc", label: "WC", icon: Bath, color: "#64748b" },
];

export function CanvasToolbar() {
  const {
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    gridEnabled,
    toggleGrid,
    selectedTableIds,
    removeTable,
    clearSelection,
    stageSelected,
    deleteStage,
    layout,
    selectedWallId,
    setWallLabel,
    createStageFromWall,
    setSelectedWallId,
    tables,
    autoArrangeTables,
    pendingTableCounts,
    placeAllPendingTables,
    clearAllTables,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore();

  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const hasStage = !!layout.stage;

  const tools = [
    { id: "select", icon: MousePointer2, label: "Seç" },
    { id: "pan", icon: Hand, label: "Kaydır" },
    { id: "draw", icon: Pencil, label: "Çizgi Çiz" },
    { id: "eraser", icon: Eraser, label: "Sil" },
  ] as const;

  const isUndoDisabled = !canUndo();
  const isRedoDisabled = !canRedo();

  const handleDeleteSelected = () => {
    selectedTableIds.forEach((id) => removeTable(id));
    clearSelection();
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg">
      {/* Araçlar */}
      <div className="flex items-center gap-1 border-r border-slate-600 pr-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={cn(
              "p-2 rounded hover:bg-slate-700 transition-colors",
              activeTool === tool.id && "bg-blue-600 hover:bg-blue-500"
            )}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5 text-white" />
          </button>
        ))}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 border-r border-slate-600 pr-2">
        <button
          onClick={undo}
          disabled={isUndoDisabled}
          className={cn(
            "p-2 rounded transition-colors",
            isUndoDisabled
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-slate-700"
          )}
          title="Geri Al (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={redo}
          disabled={isRedoDisabled}
          className={cn(
            "p-2 rounded transition-colors",
            isRedoDisabled
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-slate-700"
          )}
          title="İleri Al (Ctrl+Y)"
        >
          <Redo2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Grid toggle */}
      <button
        onClick={toggleGrid}
        className={cn(
          "p-2 rounded hover:bg-slate-700 transition-colors",
          gridEnabled && "bg-slate-600"
        )}
        title="Izgara"
      >
        <Grid3X3 className="w-5 h-5 text-white" />
      </button>

      {/* Zoom kontrolleri */}
      <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
        <button
          onClick={() => setZoom(zoom - 0.1)}
          className="p-2 rounded hover:bg-slate-700"
          title="Uzaklaştır"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-sm w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.1)}
          className="p-2 rounded hover:bg-slate-700"
          title="Yakınlaştır"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-2 rounded hover:bg-slate-700"
          title="Sıfırla"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Otomatik Yerleştir / Tümünü Kaldır */}
      {(() => {
        const totalPending = Object.values(pendingTableCounts).reduce(
          (sum, c) => sum + c,
          0
        );
        return (
          <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
            {totalPending > 0 && (
              <button
                onClick={placeAllPendingTables}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 rounded-lg text-white text-sm font-medium animate-pulse"
                title="Tüm masaları yerleştir"
              >
                <LayoutGrid className="w-4 h-4" />
                Tümünü Yerleştir ({totalPending})
              </button>
            )}
            {tables.length > 0 && (
              <>
                <button
                  onClick={autoArrangeTables}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 rounded-lg text-white text-sm font-medium"
                  title="Masaları otomatik yerleştir"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Düzenle
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg text-white text-sm font-medium"
                  title="Tüm masaları kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                  Tümünü Kaldır
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Seçili masalar için aksiyonlar */}
      {selectedTableIds.length > 0 && (
        <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
          <span className="text-white text-sm mr-2">
            {selectedTableIds.length} seçili
          </span>
          <button
            onClick={handleDeleteSelected}
            className="p-2 rounded hover:bg-red-600 text-red-400 hover:text-white"
            title="Sil"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sahne seçili ise */}
      {stageSelected && (
        <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
          <span className="text-white text-sm mr-2">
            <Square className="w-4 h-4 inline mr-1" />
            Sahne seçili
          </span>
          <button
            onClick={deleteStage}
            className="p-2 rounded hover:bg-red-600 text-red-400 hover:text-white"
            title="Sahneyi Sil"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sahne yoksa - Sahne Badge'i */}
      {!hasStage && (
        <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
          <button
            onClick={() => {
              if (selectedWallId) {
                createStageFromWall(selectedWallId);
                setSelectedWallId(null);
              } else {
                // Sahne yoksa ve çizgi seçili değilse, varsayılan sahne oluştur
                useCanvasStore.getState().setLayout({
                  ...layout,
                  stage: {
                    x: 500,
                    y: 50,
                    width: 200,
                    height: 80,
                    label: "SAHNE",
                  },
                });
              }
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium",
              selectedWallId ? "bg-green-600 animate-pulse" : "bg-blue-600"
            )}
            title={
              selectedWallId
                ? "Seçili çizgiyi sahneye dönüştür"
                : "Yeni sahne ekle"
            }
          >
            <Music className="w-4 h-4" />
            {selectedWallId ? "Sahne Yap" : "Sahne Ekle"}
          </button>
        </div>
      )}

      {/* Seçili çizgi için etiket menüsü */}
      {selectedWallId && (
        <div className="relative flex items-center gap-1 border-l border-slate-600 pl-2">
          <button
            onClick={() => setShowLabelMenu(!showLabelMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 rounded-lg text-white text-sm"
          >
            <Tag className="w-4 h-4" />
            Etiket Ekle
          </button>

          {showLabelMenu && (
            <div className="absolute top-full left-0 mt-2 bg-slate-700 rounded-lg shadow-xl p-2 z-50 min-w-[150px]">
              {WALL_LABELS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "stage") {
                      createStageFromWall(selectedWallId);
                    } else {
                      setWallLabel(selectedWallId, item.id);
                    }
                    setSelectedWallId(null);
                    setShowLabelMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-white text-sm text-left"
                  style={{ backgroundColor: item.color + "20" }}
                >
                  <item.icon
                    className="w-4 h-4"
                    style={{ color: item.color }}
                  />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Yardım Butonu - En sağda */}
      <div className="ml-auto border-l border-slate-600 pl-2">
        <button
          onClick={() => setShowHelp(true)}
          className="p-2 rounded bg-cyan-600 text-white"
          title="Nasıl Kullanılır?"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Yardım Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-cyan-400" />
                Canvas Kullanım Kılavuzu
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Araçlar */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-3">Araçlar</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <MousePointer2 className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Seç:</strong> Masaları seçmek ve taşımak için.
                      Shift+tıklama ile çoklu seçim.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Hand className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Kaydır:</strong> Canvas&apos;ı sürükleyerek
                      kaydırın.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pencil className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Çizgi Çiz:</strong> Duvar, bölge veya alan çizmek
                      için.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Eraser className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Sil:</strong> Çizgileri silmek için tıklayın.
                    </span>
                  </div>
                </div>
              </div>

              {/* Geri Al / İleri Al */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-3">
                  Geri Al / İleri Al
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Undo2 className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Geri Al:</strong> Son işlemi geri alır. (Ctrl+Z)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Redo2 className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>İleri Al:</strong> Geri alınan işlemi tekrar
                      uygular. (Ctrl+Y)
                    </span>
                  </div>
                </div>
              </div>

              {/* Görünüm */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-3">Görünüm</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Grid3X3 className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Izgara:</strong> Hizalama için ızgarayı
                      açar/kapatır.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ZoomIn className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Yakınlaştır/Uzaklaştır:</strong> Canvas&apos;ı
                      büyütür veya küçültür.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-5 h-5 text-blue-400" />
                    <span>
                      <strong>Sıfırla:</strong> Zoom&apos;u %100&apos;e
                      döndürür.
                    </span>
                  </div>
                </div>
              </div>

              {/* Masa İşlemleri */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-3">
                  Masa İşlemleri
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-purple-400" />
                    <span>
                      <strong>Düzenle:</strong> Masaları otomatik olarak düzenli
                      yerleştirir.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <span>
                      <strong>Tümünü Kaldır:</strong> Tüm masaları siler
                      (Localar hariç).
                    </span>
                  </div>
                </div>
              </div>

              {/* Kısayollar */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-3">
                  Klavye Kısayolları
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">Delete</kbd>{" "}
                    Seçili masaları sil
                  </div>
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">Ctrl+Z</kbd>{" "}
                    Geri al
                  </div>
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">Ctrl+Y</kbd>{" "}
                    İleri al
                  </div>
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">
                      Shift+Tıkla
                    </kbd>{" "}
                    Çoklu seçim
                  </div>
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">Escape</kbd>{" "}
                    Seçimi temizle
                  </div>
                  <div>
                    <kbd className="bg-slate-600 px-2 py-1 rounded">Scroll</kbd>{" "}
                    Yakınlaştır/Uzaklaştır
                  </div>
                </div>
              </div>

              {/* İpuçları */}
              <div className="bg-cyan-900/30 border border-cyan-700 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-400 mb-2">
                  💡 İpuçları
                </h3>
                <ul className="text-sm space-y-1 text-cyan-200">
                  <li>
                    • Sağ panelden masa türü ve sayısı seçip
                    &quot;Yerleştir&quot; butonuna basın
                  </li>
                  <li>
                    • Masaları sürükleyerek istediğiniz konuma taşıyabilirsiniz
                  </li>
                  <li>• Box selection için boş alana tıklayıp sürükleyin</li>
                  <li>
                    • Çizgi çizip &quot;Sahne Yap&quot; ile sahneye
                    dönüştürebilirsiniz
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-slate-700">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full py-2 bg-cyan-600 rounded-lg font-medium"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tümünü Kaldır Onay Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Tüm Masaları Kaldır"
        description={`${tables.length} masayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Tümünü Kaldır"
        cancelText="İptal"
        variant="destructive"
        onConfirm={() => {
          clearAllTables();
          setShowClearConfirm(false);
        }}
      />
    </div>
  );
}
