"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trash2,
  Maximize2,
  Settings,
  Lock,
  Unlock,
  Move,
  Copy,
  ArrowLeftRight,
  Edit3,
} from "lucide-react";
import type {
  ContextMenuState,
  StageElement,
  PlacedTable,
  TableType,
} from "../types";
import { CONTEXT_MENU_ITEMS, TABLE_TYPE_CONFIG } from "../constants";

// Akıllı pozisyon hesaplama - ekran sınırlarına göre drop-up/drop-down
function useSmartPosition(
  x: number,
  y: number,
  visible: boolean
): { style: React.CSSProperties; isDropUp: boolean } {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState(200);
  const [menuWidth, setMenuWidth] = useState(200);

  useEffect(() => {
    if (menuRef.current && visible) {
      setMenuHeight(menuRef.current.offsetHeight);
      setMenuWidth(menuRef.current.offsetWidth);
    }
  }, [visible]);

  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;

  // Alt kısımda yer yoksa yukarı aç
  const isDropUp = y + menuHeight > viewportHeight - 20;
  // Sağda yer yoksa sola aç
  const isDropLeft = x + menuWidth > viewportWidth - 20;

  const style: React.CSSProperties = {
    position: "fixed",
    left: isDropLeft ? x - menuWidth : x,
    top: isDropUp ? y - menuHeight : y,
    zIndex: 9999,
  };

  return { style, isDropUp };
}

interface CanvasContextMenuProps {
  contextMenu: ContextMenuState;
  onAction: (type: "stage" | "area" | "table" | "loca") => void;
  onClose: () => void;
}

export function CanvasContextMenu({
  contextMenu,
  onAction,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useSmartPosition(
    contextMenu.x,
    contextMenu.y,
    contextMenu.visible && contextMenu.targetType === "canvas"
  );

  if (!contextMenu.visible || contextMenu.targetType !== "canvas") return null;

  return (
    <div
      ref={menuRef}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-700 mb-1">
        Konum: {contextMenu.gridCol}
        {contextMenu.gridRow}
      </div>
      {CONTEXT_MENU_ITEMS.map((item) => (
        <button
          key={item.type}
          onClick={() => onAction(item.type)}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <item.icon className="w-4 h-4" style={{ color: item.color }} />
          {item.label}
        </button>
      ))}
      <div className="border-t border-slate-700 mt-1 pt-1">
        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 transition-colors"
        >
          <span className="w-4 h-4" />
          İptal
        </button>
      </div>
    </div>
  );
}

interface StageContextMenuProps {
  contextMenu: ContextMenuState;
  stageElements: StageElement[];
  onCenterHorizontally: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function StageContextMenu({
  contextMenu,
  stageElements,
  onCenterHorizontally,
  onEdit,
  onToggleLock,
  onDelete,
  onClose,
}: StageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useSmartPosition(
    contextMenu.x,
    contextMenu.y,
    contextMenu.visible && contextMenu.targetType === "stage"
  );

  if (
    !contextMenu.visible ||
    contextMenu.targetType !== "stage" ||
    !contextMenu.targetId
  )
    return null;

  const stage = stageElements.find((s) => s.id === contextMenu.targetId);
  if (!stage) return null;

  return (
    <div
      ref={menuRef}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-700 mb-1">
        {stage.label || "Element"}
      </div>

      <button
        onClick={() => {
          onCenterHorizontally(contextMenu.targetId!);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <Maximize2 className="w-4 h-4 text-blue-400" />
        Yatay Ortala
      </button>

      <button
        onClick={() => {
          onEdit(contextMenu.targetId!);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <Settings className="w-4 h-4 text-purple-400" />
        Düzenle
      </button>

      <button
        onClick={() => {
          onToggleLock(contextMenu.targetId!);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      >
        {stage.isLocked ? (
          <>
            <Unlock className="w-4 h-4 text-green-400" />
            Kilidi Aç
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 text-amber-400" />
            Sabitle
          </>
        )}
      </button>

      <div className="border-t border-slate-700 mt-1 pt-1">
        <button
          onClick={() => {
            onDelete(contextMenu.targetId!);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Sil
        </button>
      </div>
    </div>
  );
}

interface TableContextMenuProps {
  contextMenu: ContextMenuState;
  placedTables: PlacedTable[];
  selectedItems: string[];
  onAssignType: (id: string, type: TableType) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onResize: (ids: string[]) => void;
  onApplySizeToSameType: (id: string) => void;
  onSpacing: (ids: string[]) => void;
  onEditLocaName: (id: string) => void;
  onClose: () => void;
}

export function TableContextMenu({
  contextMenu,
  placedTables,
  selectedItems,
  onAssignType,
  onToggleLock,
  onDelete,
  onResize,
  onApplySizeToSameType,
  onSpacing,
  onEditLocaName,
  onClose,
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useSmartPosition(
    contextMenu.x,
    contextMenu.y,
    contextMenu.visible && contextMenu.targetType === "table"
  );

  if (
    !contextMenu.visible ||
    contextMenu.targetType !== "table" ||
    !contextMenu.targetId
  )
    return null;

  const table = placedTables.find((t) => t.id === contextMenu.targetId);
  if (!table) return null;

  // Seçili masalar varsa onları kullan, yoksa sadece tıklanan masayı
  const targetIds =
    selectedItems.length > 0 && selectedItems.includes(contextMenu.targetId)
      ? selectedItems
      : [contextMenu.targetId];

  const hasCustomSize = table.size && table.size !== 32;

  return (
    <div
      ref={menuRef}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-700 mb-1">
        {targetIds.length > 1
          ? `${targetIds.length} masa seçili`
          : table.isLoca
          ? `Loca: ${table.locaName}`
          : `Masa ${table.tableNumber}`}
      </div>

      {/* Loca İsim Ver */}
      {table.isLoca && targetIds.length === 1 && (
        <button
          onClick={() => {
            onEditLocaName(contextMenu.targetId!);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <Edit3 className="w-4 h-4 text-amber-400" />
          İsim Ver
        </button>
      )}

      {/* Boyutlandır */}
      <button
        onClick={() => {
          onResize(targetIds);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <Move className="w-4 h-4 text-cyan-400" />
        Boyutlandır
      </button>

      {/* Aralık Ayarla - En az 2 masa seçili olmalı */}
      {targetIds.length >= 2 && (
        <button
          onClick={() => {
            onSpacing(targetIds);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4 text-violet-400" />
          Aralık Ayarla
        </button>
      )}

      {/* Tüm aynı tip masaları aynı boyutta yap */}
      {hasCustomSize && (
        <button
          onClick={() => {
            onApplySizeToSameType(contextMenu.targetId!);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <Copy className="w-4 h-4 text-emerald-400" />
          Aynı Tip Masaları Eşitle
        </button>
      )}

      <div className="px-3 py-1 text-xs text-slate-500 mt-1">Tip Ata:</div>
      {(
        Object.entries(TABLE_TYPE_CONFIG) as [
          TableType,
          typeof TABLE_TYPE_CONFIG.vip
        ][]
      )
        .filter(([key]) => key !== "unassigned" && key !== "loca")
        .map(([type, config]) => (
          <button
            key={type}
            onClick={() => {
              onAssignType(contextMenu.targetId!, type);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            {config.label}
          </button>
        ))}

      <div className="border-t border-slate-700 mt-1 pt-1">
        <button
          onClick={() => {
            onToggleLock(contextMenu.targetId!);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          {table.isLocked ? (
            <>
              <Unlock className="w-4 h-4 text-green-400" />
              Kilidi Aç
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-amber-400" />
              Sabitle
            </>
          )}
        </button>

        <button
          onClick={() => {
            onDelete(contextMenu.targetId!);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Sil
        </button>
      </div>
    </div>
  );
}
