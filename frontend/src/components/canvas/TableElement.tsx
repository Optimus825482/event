"use client";

import { memo, CSSProperties, useState } from "react";

// Types
type TableType = "standard" | "premium" | "vip" | "loca" | "unassigned";

interface PlacedTable {
  id: string;
  tableNumber: number;
  type: TableType;
  capacity: number;
  x: number;
  y: number;
  isLoca: boolean;
  locaName?: string;
  isLocked: boolean;
}

interface CustomTableType {
  id: string;
  label: string;
  color: string;
}

// Constants
const TABLE_TYPE_CONFIG: Record<
  TableType,
  { color: string; borderColor: string }
> = {
  unassigned: { color: "#6b7280", borderColor: "#9ca3af" },
  standard: { color: "#3b82f6", borderColor: "#60a5fa" },
  premium: { color: "#8b5cf6", borderColor: "#a78bfa" },
  vip: { color: "#f59e0b", borderColor: "#fbbf24" },
  loca: { color: "#ec4899", borderColor: "#f472b6" },
};

// Kapasiteye göre renk tonu hesaplama (6-14 kişi arası)
// Düşük kapasite = açık ton, yüksek kapasite = koyu ton
const getCapacityShade = (baseColor: string, capacity: number): string => {
  // 6 kişi = 1.3 (açık), 14 kişi = 0.7 (koyu)
  const minCap = 6;
  const maxCap = 14;
  const normalizedCap = Math.min(Math.max(capacity, minCap), maxCap);
  const ratio = (normalizedCap - minCap) / (maxCap - minCap); // 0-1 arası
  const brightness = 1.3 - ratio * 0.6; // 1.3'ten 0.7'ye

  // Hex rengi RGB'ye çevir
  const hex = baseColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Brightness uygula
  const newR = Math.min(255, Math.round(r * brightness));
  const newG = Math.min(255, Math.round(g * brightness));
  const newB = Math.min(255, Math.round(b * brightness));

  return `rgb(${newR}, ${newG}, ${newB})`;
};

interface TableElementProps {
  table: PlacedTable;
  isSelected: boolean;
  activeTool: string;
  customTableTypes: CustomTableType[];
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
  onContextMenu: (e: React.MouseEvent, tableId: string) => void;
}

// Memoized Table Element - sadece props değiştiğinde re-render olur
export const TableElement = memo(
  function TableElement({
    table,
    isSelected,
    activeTool,
    customTableTypes,
    onMouseDown,
    onContextMenu,
  }: TableElementProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    // Renk hesaplama
    const defaultConfig = TABLE_TYPE_CONFIG[table.type as TableType];
    const customType = customTableTypes.find((ct) => ct.id === table.type);
    const baseColor = defaultConfig?.color || customType?.color || "#6b7280";

    // Kapasiteye göre renk tonu
    const color = getCapacityShade(baseColor, table.capacity);
    const borderColor =
      defaultConfig?.borderColor ||
      (customType ? `${customType.color}80` : "#9ca3af");

    // Style - inline yerine object
    const containerStyle: CSSProperties = {
      left: table.x,
      top: table.y,
      cursor:
        activeTool === "assign"
          ? "pointer"
          : activeTool === "select"
          ? "move"
          : "default",
    };

    const circleStyle: CSSProperties = {
      backgroundColor: color,
      borderColor: borderColor,
    };

    return (
      <div
        className={`absolute select-none transition-transform ${
          isSelected
            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10"
            : ""
        }`}
        style={containerStyle}
        onMouseDown={(e) => onMouseDown(e, table.id)}
        onContextMenu={(e) => onContextMenu(e, table.id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className="w-8 h-8 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2"
          style={circleStyle}
        >
          <span className="text-[8px] font-bold">{table.tableNumber}</span>
        </div>

        {/* Tooltip - Kapasite bilgisi */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
            {table.capacity} Kişilik
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - handler referansları da kontrol edilmeli
    return (
      prevProps.table.id === nextProps.table.id &&
      prevProps.table.x === nextProps.table.x &&
      prevProps.table.y === nextProps.table.y &&
      prevProps.table.type === nextProps.table.type &&
      prevProps.table.tableNumber === nextProps.table.tableNumber &&
      prevProps.table.capacity === nextProps.table.capacity &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.activeTool === nextProps.activeTool &&
      prevProps.onMouseDown === nextProps.onMouseDown &&
      prevProps.onContextMenu === nextProps.onContextMenu
    );
  }
);

// Loca Element
interface LocaElementProps {
  loca: PlacedTable;
  isSelected: boolean;
  activeTool: string;
  customTableTypes: CustomTableType[];
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
  onContextMenu: (e: React.MouseEvent, tableId: string) => void;
}

export const LocaElement = memo(
  function LocaElement({
    loca,
    isSelected,
    activeTool,
    customTableTypes,
    onMouseDown,
    onContextMenu,
  }: LocaElementProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    const defaultConfig = TABLE_TYPE_CONFIG[loca.type as TableType];
    const customType = customTableTypes.find((ct) => ct.id === loca.type);
    const baseColor = defaultConfig?.color || customType?.color || "#6b7280";

    // Kapasiteye göre renk tonu
    const color = getCapacityShade(baseColor, loca.capacity);
    const borderColor =
      defaultConfig?.borderColor ||
      (customType ? `${customType.color}80` : "#9ca3af");

    const containerStyle: CSSProperties = {
      left: loca.x,
      top: loca.y,
      cursor:
        activeTool === "assign"
          ? "pointer"
          : activeTool === "select"
          ? "move"
          : "default",
    };

    const boxStyle: CSSProperties = {
      backgroundColor: color,
      borderColor: borderColor,
    };

    return (
      <div
        className={`absolute select-none ${
          isSelected
            ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900 z-10"
            : ""
        }`}
        style={containerStyle}
        onMouseDown={(e) => onMouseDown(e, loca.id)}
        onContextMenu={(e) => onContextMenu(e, loca.id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className="w-[70px] h-[28px] rounded flex items-center justify-center text-white shadow-lg border-2"
          style={boxStyle}
        >
          <span className="text-[9px] font-bold">{loca.locaName}</span>
        </div>

        {/* Tooltip - Kapasite bilgisi */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
            {loca.capacity} Kişilik
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Handler referansları da kontrol edilmeli
    return (
      prevProps.loca.id === nextProps.loca.id &&
      prevProps.loca.x === nextProps.loca.x &&
      prevProps.loca.y === nextProps.loca.y &&
      prevProps.loca.type === nextProps.loca.type &&
      prevProps.loca.locaName === nextProps.loca.locaName &&
      prevProps.loca.capacity === nextProps.loca.capacity &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.activeTool === nextProps.activeTool &&
      prevProps.onMouseDown === nextProps.onMouseDown &&
      prevProps.onContextMenu === nextProps.onContextMenu
    );
  }
);
