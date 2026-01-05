"use client";

import {
  memo,
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useState,
} from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer2,
  Hand,
  Maximize2,
  Sofa,
  Plus,
  Wine,
  Star,
  UserCheck,
  Sparkles,
  Shield,
  Coffee,
  MapPin,
  Users,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TableData,
  TableGroup,
  Staff,
  StageElement,
  TeamDefinition,
  ServicePoint,
} from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, Point } from "../utils";
import { CanvasTool } from "../hooks/useCanvasInteraction";
import { cn } from "@/lib/utils";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";

// ==================== CONSTANTS ====================
const TABLE_SIZE = 32;
const LOCA_WIDTH = 48;
const LOCA_HEIGHT = 24;

// ==================== MEMOIZED TABLE COMPONENT ====================
interface TableItemProps {
  table: TableData;
  isSelected: boolean;
  group?: TableGroup;
  assignedTeam?: TeamDefinition | null;
  assignedStaff?: Staff | null;
  onClick: (tableId: string, e: React.MouseEvent) => void;
}

const TableItem = memo(function TableItem({
  table,
  isSelected,
  group,
  assignedTeam,
  assignedStaff,
  onClick,
}: TableItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(table.id, e);
    },
    [table.id, onClick]
  );

  // Tooltip içeriği
  const tooltipContent = group
    ? `${group.name}${assignedTeam ? ` • ${assignedTeam.name}` : ""}`
    : "Gruba atanmamış";

  return (
    <div
      data-table-id={table.id}
      className={cn(
        "absolute select-none transition-transform cursor-pointer",
        isSelected &&
          "ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10 scale-110"
      )}
      style={{
        left: table.x,
        top: table.y,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 pointer-events-none shadow-xl bg-slate-900 border border-slate-600">
          <span style={{ color: group?.color || "#94a3b8" }}>
            {tooltipContent}
          </span>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900" />
        </div>
      )}

      {/* Team background - kare şeklinde takım rengi */}
      {assignedTeam && (
        <div
          className="absolute -inset-3 rounded-lg"
          style={{
            backgroundColor: assignedTeam.color,
            opacity: 0.35,
          }}
        />
      )}

      {/* Group background glow - sadece takım yoksa */}
      {group && !assignedTeam && (
        <div
          className="absolute -inset-1 rounded-full opacity-40"
          style={{ backgroundColor: group.color }}
        />
      )}

      {/* Table circle */}
      <div
        className="w-8 h-8 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2 relative"
        style={{
          backgroundColor: group?.color || "#6b7280",
          borderColor: isSelected
            ? "#fbbf24"
            : assignedStaff
            ? "#10b981"
            : group?.color || "#9ca3af",
        }}
      >
        <span className="text-[9px] font-bold">{table.label}</span>

        {/* Assigned staff indicator */}
        {assignedStaff && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center"
            title={assignedStaff.fullName}
          >
            <span className="text-[6px] font-bold text-white">
              {assignedStaff.fullName.charAt(0)}
            </span>
          </div>
        )}

        {/* Ungrouped indicator */}
        {!group && (
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center"
            title="Gruba atanmamış"
          >
            <span className="text-[6px]">?</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== MEMOIZED LOCA COMPONENT ====================
interface LocaItemProps {
  loca: TableData;
  isSelected: boolean;
  group?: TableGroup;
  assignedStaff?: Staff | null;
  onClick: (tableId: string, e: React.MouseEvent) => void;
}

const LocaItem = memo(function LocaItem({
  loca,
  isSelected,
  group,
  assignedStaff,
  onClick,
}: LocaItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(loca.id, e);
    },
    [loca.id, onClick]
  );

  const locaColor = group?.color || "#8b5cf6";
  const boothWidth = 56;
  const boothHeight = 40;

  return (
    <div
      data-table-id={loca.id}
      className={cn(
        "absolute select-none transition-all cursor-pointer",
        isSelected && "z-10 scale-105"
      )}
      style={{
        left: loca.x - (boothWidth - LOCA_WIDTH) / 2,
        top: loca.y - (boothHeight - LOCA_HEIGHT) / 2,
        width: boothWidth,
        height: boothHeight,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 pointer-events-none shadow-xl bg-slate-900 border border-slate-600">
          <span style={{ color: locaColor }}>
            {loca.locaName || loca.label} {group ? `• ${group.name}` : ""}
          </span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900" />
        </div>
      )}

      {/* VIP Booth çerçevesi */}
      <div
        className={cn(
          "absolute inset-0 rounded-lg transition-all",
          isSelected &&
            "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900"
        )}
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #0f172a 100%)",
          border: `2px solid ${locaColor}`,
          boxShadow: isSelected
            ? `0 0 16px ${locaColor}60, inset 0 0 8px ${locaColor}20`
            : `0 0 8px ${locaColor}30`,
        }}
      />

      {/* Arka duvar (sırtlık) */}
      <div
        className="absolute top-1 left-1/2 -translate-x-1/2 rounded-t-sm"
        style={{
          width: boothWidth - 8,
          height: boothHeight * 0.28,
          background: "linear-gradient(180deg, #2d1f4e 0%, #1a1a2e 100%)",
          borderBottom: `1px solid ${locaColor}40`,
        }}
      />

      {/* Kanepe oturma yeri */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm"
        style={{
          width: boothWidth - 12,
          height: boothHeight * 0.32,
          background: "linear-gradient(180deg, #3b2d5f 0%, #2d1f4e 100%)",
          border: `1px solid ${locaColor}60`,
        }}
      />

      {/* Sol kol dayama */}
      <div
        className="absolute left-1 top-1/2 -translate-y-1/2 rounded-sm"
        style={{
          width: 4,
          height: boothHeight * 0.45,
          background: `linear-gradient(90deg, ${locaColor}40 0%, #1a1a2e 100%)`,
        }}
      />

      {/* Sağ kol dayama */}
      <div
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm"
        style={{
          width: 4,
          height: boothHeight * 0.45,
          background: `linear-gradient(270deg, ${locaColor}40 0%, #1a1a2e 100%)`,
        }}
      />

      {/* Neon alt kenar */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-b-lg"
        style={{
          width: boothWidth - 4,
          height: 2,
          backgroundColor: locaColor,
          boxShadow: `0 0 6px ${locaColor}, 0 0 12px ${locaColor}60`,
        }}
      />

      {/* Loca ismi */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold text-white text-center"
        style={{
          textShadow: `0 0 6px ${locaColor}, 0 1px 2px rgba(0,0,0,0.8)`,
        }}
      >
        {loca.locaName || loca.label}
      </div>

      {/* VIP badge */}
      <div
        className="absolute -top-1.5 -right-1.5 px-1 py-0.5 rounded text-[7px] font-bold"
        style={{
          backgroundColor: locaColor,
          color: "#fff",
          boxShadow: `0 0 4px ${locaColor}`,
        }}
      >
        VIP
      </div>

      {/* Atanmış personel göstergesi */}
      {assignedStaff && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center"
          title={assignedStaff.fullName}
        >
          <span className="text-[7px] font-bold text-white">
            {assignedStaff.fullName.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
});

// ==================== MEMOIZED STAGE ELEMENT COMPONENT ====================
interface StageItemProps {
  element: StageElement;
}

const StageItem = memo(function StageItem({ element }: StageItemProps) {
  const getStageColor = (type: string) => {
    switch (type) {
      case "stage":
        return "bg-blue-600";
      case "catwalk1":
      case "catwalk2":
        return "bg-purple-500";
      case "system_control":
        return "bg-amber-600";
      default:
        return "bg-slate-600";
    }
  };

  return (
    <div
      className="absolute select-none pointer-events-none"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
      }}
    >
      <div
        className={`w-full h-full rounded-lg flex items-center justify-center ${getStageColor(
          element.type
        )}`}
      >
        <span className="text-xs font-medium text-white">{element.label}</span>
      </div>
    </div>
  );
});

// ==================== SERVICE POINT ICON MAP ====================
const SERVICE_POINT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  bar: Wine,
  lounge: Star,
  reception: UserCheck,
  vip_area: Sparkles,
  backstage: Shield,
  other: Coffee,
};

// ==================== MEMOIZED SERVICE POINT COMPONENT ====================
interface ServicePointItemProps {
  servicePoint: ServicePoint;
  isSelected?: boolean;
  onClick?: (id: string, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string) => void;
}

const ServicePointItem = memo(function ServicePointItem({
  servicePoint,
  isSelected = false,
  onDoubleClick,
}: ServicePointItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = SERVICE_POINT_ICONS[servicePoint.pointType] || MapPin;

  // staffAssignments varsa ondan hesapla, yoksa assignedStaffCount kullan
  const assignedCount =
    servicePoint.staffAssignments?.length ||
    servicePoint.assignedStaffCount ||
    0;
  const requiredCount = servicePoint.requiredStaffCount;
  const isComplete = assignedCount >= requiredCount;
  const hasPartial = assignedCount > 0 && assignedCount < requiredCount;

  // Sol tık: personel atama modalını aç (onDoubleClick çağır)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Sol tıklama ile direkt personel atama modalını aç
      onDoubleClick?.(servicePoint.id);
    },
    [servicePoint.id, onDoubleClick]
  );

  return (
    <div
      className={cn(
        "absolute cursor-pointer transition-all duration-200",
        "flex flex-col items-center gap-1",
        isSelected && "z-50"
      )}
      style={{
        left: servicePoint.x,
        top: servicePoint.y,
        transform: "translate(-50%, -50%)",
      }}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 pointer-events-none shadow-xl bg-slate-900 border border-slate-600">
          <span style={{ color: servicePoint.color }}>
            {servicePoint.name} • {assignedCount}/{requiredCount} personel
          </span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900" />
        </div>
      )}

      {/* Ana Kare Element */}
      <div
        className={cn(
          "rounded-lg flex items-center justify-center transition-all",
          "border-2 shadow-lg",
          isSelected
            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
            : "hover:scale-105"
        )}
        style={{
          width: 50,
          height: 50,
          backgroundColor: `${servicePoint.color}30`,
          borderColor: servicePoint.color,
          boxShadow: isSelected
            ? `0 0 20px ${servicePoint.color}50`
            : `0 4px 12px ${servicePoint.color}20`,
        }}
      >
        <span style={{ color: servicePoint.color }}>
          <Icon className="w-6 h-6" />
        </span>
      </div>

      {/* İsim Etiketi */}
      <div
        className={cn(
          "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
          "bg-slate-800/90 backdrop-blur-sm border border-slate-700"
        )}
        style={{ color: servicePoint.color }}
      >
        {servicePoint.name}
      </div>

      {/* Personel Sayısı Badge */}
      <div
        className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full",
          "flex items-center justify-center text-xs font-bold",
          "border-2 border-slate-900",
          isComplete
            ? "bg-emerald-500 text-white"
            : hasPartial
            ? "bg-amber-500 text-white"
            : "bg-slate-600 text-slate-300"
        )}
        title={`${assignedCount}/${requiredCount} personel atandı`}
      >
        {assignedCount}
      </div>

      {/* Gerekli Personel Göstergesi */}
      <div
        className={cn(
          "absolute -bottom-1 left-1/2 -translate-x-1/2",
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
          "bg-slate-800/90 backdrop-blur-sm border border-slate-700",
          "text-[10px] font-medium"
        )}
      >
        <Users className="w-3 h-3 text-slate-400" />
        <span className="text-slate-300">
          {assignedCount}/{requiredCount}
        </span>
      </div>
    </div>
  );
});

// ==================== CANVAS TOOLBAR ====================
interface CanvasToolbarProps {
  zoom: number;
  activeTool: CanvasTool;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToolChange: (tool: CanvasTool) => void;
  onSelectAll?: () => void;
  selectedCount?: number;
  totalCount?: number;
  showToolSelector?: boolean;
}

export const CanvasToolbar = memo(function CanvasToolbar({
  zoom,
  activeTool,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToolChange,
  onSelectAll,
  selectedCount = 0,
  totalCount = 0,
  showToolSelector = true,
}: CanvasToolbarProps) {
  return (
    <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-lg p-1.5 border border-slate-700">
      {/* Tool Selector */}
      {showToolSelector && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === "select" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => onToolChange("select")}
              >
                <MousePointer2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Seçim Aracı (Lasso)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === "pan" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => onToolChange("pan")}
              >
                <Hand className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kaydırma Aracı</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-slate-600" />
        </>
      )}

      {/* Zoom Controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Uzaklaştır</TooltipContent>
      </Tooltip>

      <span className="text-xs text-slate-400 min-w-[40px] text-center">
        {Math.round(zoom * 100)}%
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onZoomIn}
            disabled={zoom >= 2}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Yakınlaştır</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onResetView}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Görünümü Sıfırla</TooltipContent>
      </Tooltip>

      {/* Selection Info */}
      {selectedCount > 0 && (
        <>
          <div className="w-px h-6 bg-slate-600" />
          <span className="text-xs text-purple-400 font-medium">
            {selectedCount} / {totalCount} seçili
          </span>
        </>
      )}

      {/* Select All */}
      {onSelectAll && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onSelectAll}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tümünü Seç (Ctrl+A)</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});

// ==================== LASSO SELECTION OVERLAY ====================
interface LassoOverlayProps {
  isSelecting: boolean;
  start: Point;
  end: Point;
  zoom: number;
  offset: Point;
}

const LassoOverlay = memo(function LassoOverlay({
  isSelecting,
  start,
  end,
  zoom,
  offset,
}: LassoOverlayProps) {
  if (!isSelecting) return null;

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return (
    <div
      className="absolute border-2 border-purple-500 bg-purple-500/20 pointer-events-none z-30"
      style={{
        left: minX * zoom + offset.x,
        top: minY * zoom + offset.y,
        width: (maxX - minX) * zoom,
        height: (maxY - minY) * zoom,
      }}
    />
  );
});

// ==================== MAIN CANVAS RENDERER ====================
interface CanvasRendererProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  teams?: TeamDefinition[];
  stageElements?: StageElement[];
  servicePoints?: ServicePoint[];
  selectedTableIds: string[];
  selectedServicePointId?: string | null;
  zoom: number;
  offset: Point;
  activeTool: CanvasTool;
  isLassoSelecting: boolean;
  lassoStart: Point;
  lassoEnd: Point;
  staffAssignments?: Map<string, Staff>;
  viewMode?: "2d" | "3d";
  onTableClick: (tableId: string, e: React.MouseEvent) => void;
  onServicePointClick?: (servicePointId: string, e: React.MouseEvent) => void;
  onServicePointDoubleClick?: (servicePointId: string) => void;
  onCanvasMouseDown: (
    e: React.MouseEvent,
    canvasRef: React.RefObject<HTMLDivElement>
  ) => void;
  onCanvasMouseMove: (
    e: React.MouseEvent,
    canvasRef: React.RefObject<HTMLDivElement>
  ) => void;
  onCanvasMouseUp: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToolChange: (tool: CanvasTool) => void;
  onSelectAll?: () => void;
  onCreateGroup?: () => void;
  className?: string;
  showToolbar?: boolean;
  showCreateGroupButton?: boolean;
  showServicePoints?: boolean;
  readOnly?: boolean;
  show3DToggle?: boolean;
}

export const CanvasRenderer = forwardRef<HTMLDivElement, CanvasRendererProps>(
  function CanvasRenderer(
    {
      tables,
      tableGroups,
      teams = [],
      stageElements = [],
      servicePoints = [],
      selectedTableIds,
      selectedServicePointId,
      zoom,
      offset,
      activeTool,
      isLassoSelecting,
      lassoStart,
      lassoEnd,
      staffAssignments,
      viewMode = "2d",
      onTableClick,
      onServicePointClick,
      onServicePointDoubleClick,
      onCanvasMouseDown,
      onCanvasMouseMove,
      onCanvasMouseUp,
      onZoomIn,
      onZoomOut,
      onResetView,
      onToolChange,
      onSelectAll,
      onCreateGroup,
      className,
      showToolbar = true,
      showCreateGroupButton = false,
      showServicePoints = true,
      readOnly = false,
      show3DToggle = false,
    },
    ref
  ) {
    const internalRef = useRef<HTMLDivElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

    // Table label -> Table ID map (masa numarası -> UUID)
    const labelToIdMap = useMemo(() => {
      const map = new Map<string, string>();
      tables.forEach((t) => map.set(t.label, t.id));
      return map;
    }, [tables]);

    // Table -> Group map (UUID bazlı)
    const tableToGroupMap = useMemo(() => {
      const map = new Map<string, TableGroup>();
      tableGroups.forEach((group) => {
        group.tableIds.forEach((tableLabel) => {
          // tableLabel masa numarası ("1", "2", "3"), UUID'ye çevir
          const tableId = labelToIdMap.get(tableLabel);
          if (tableId) {
            map.set(tableId, group);
          }
        });
      });
      return map;
    }, [tableGroups, labelToIdMap]);

    // Group -> Team map
    const groupToTeamMap = useMemo(() => {
      const map = new Map<string, TeamDefinition>();
      tableGroups.forEach((group) => {
        if (group.assignedTeamId) {
          const team = teams.find((t) => t.id === group.assignedTeamId);
          if (team) {
            map.set(group.id, team);
          }
        }
      });
      return map;
    }, [tableGroups, teams]);

    // Get assigned team for a table
    const getAssignedTeam = useCallback(
      (tableId: string): TeamDefinition | null => {
        const group = tableToGroupMap.get(tableId);
        if (!group) return null;
        return groupToTeamMap.get(group.id) || null;
      },
      [tableToGroupMap, groupToTeamMap]
    );

    // Separate tables and locas
    const { regularTables, locas } = useMemo(() => {
      const regular: TableData[] = [];
      const loca: TableData[] = [];
      tables.forEach((t) => {
        if (t.isLoca) {
          loca.push(t);
        } else {
          regular.push(t);
        }
      });
      return { regularTables: regular, locas: loca };
    }, [tables]);

    // Mouse handlers
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (readOnly) return;
        onCanvasMouseDown(e, canvasRef);
      },
      [readOnly, onCanvasMouseDown, canvasRef]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (readOnly) return;
        onCanvasMouseMove(e, canvasRef);
      },
      [readOnly, onCanvasMouseMove, canvasRef]
    );

    const handleMouseUp = useCallback(() => {
      if (readOnly) return;
      onCanvasMouseUp();
    }, [readOnly, onCanvasMouseUp]);

    // Get table group helper
    const getTableGroup = useCallback(
      (tableId: string) => tableToGroupMap.get(tableId),
      [tableToGroupMap]
    );

    // Handle table click with group selection
    const handleTableClick = useCallback(
      (tableId: string, e: React.MouseEvent) => {
        if (readOnly) return;
        onTableClick(tableId, e);
      },
      [readOnly, onTableClick]
    );

    return (
      <div
        className={cn(
          "relative overflow-hidden bg-slate-900 rounded-lg",
          className
        )}
      >
        {/* Toolbar */}
        {showToolbar && !readOnly && (
          <CanvasToolbar
            zoom={zoom}
            activeTool={activeTool}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onResetView={onResetView}
            onToolChange={onToolChange}
            onSelectAll={onSelectAll}
            selectedCount={selectedTableIds.length}
            totalCount={tables.length}
          />
        )}

        {/* Yeni Grup Butonu - Canvas üst sağ */}
        {showCreateGroupButton &&
          onCreateGroup &&
          selectedTableIds.length > 0 &&
          viewMode === "2d" && (
            <div className="absolute top-2 right-24 z-20">
              <Button
                size="sm"
                onClick={onCreateGroup}
                className="bg-emerald-600 hover:bg-emerald-700 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-1" />
                Yeni Grup ({selectedTableIds.length} masa)
              </Button>
            </div>
          )}

        {/* 3D View Mode */}
        {viewMode === "3d" ? (
          <div style={{ width: "100%", height: "600px" }}>
            <Canvas3DPreview
              layout={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                tables: [],
                walls: [],
                gridSize: 20,
                zones: stageElements.map((el) => ({
                  id: el.id,
                  type:
                    el.type === "stage"
                      ? "stage"
                      : el.type === "system_control"
                      ? "system"
                      : "stage-extension",
                  x: el.x,
                  y: el.y,
                  width: el.width,
                  height: el.height,
                  label: el.label,
                  color:
                    el.type === "stage"
                      ? "#1e40af"
                      : el.type === "system_control"
                      ? "#d97706"
                      : "#7c3aed",
                })),
              }}
              tables={tables.map((t) => {
                const group = tableToGroupMap.get(t.id);
                const isLoca = t.isLoca || t.locaName;
                return {
                  id: t.id,
                  typeId: t.type || "standard",
                  typeName: isLoca
                    ? "Loca"
                    : group?.name || t.typeName || "Masa",
                  x: t.x + TABLE_SIZE / 2,
                  y: t.y + TABLE_SIZE / 2,
                  rotation: 0,
                  capacity: t.capacity || 12,
                  color:
                    group?.color || t.color || (isLoca ? "#ec4899" : "#3b82f6"),
                  shape: isLoca ? "square" : "round",
                  label: isLoca ? t.locaName || t.label : t.label,
                  floor: isLoca ? 2 : 1,
                };
              })}
              servicePoints={servicePoints}
              tableGroups={tableGroups}
              teams={teams}
              viewMode={teams.length > 0 ? "step2" : "step1"}
              selectedTableIds={selectedTableIds}
            />
          </div>
        ) : (
          /* 2D Canvas Container */
          <div
            ref={canvasRef}
            className={cn(
              "relative overflow-hidden",
              activeTool === "pan" ? "cursor-grab" : "cursor-crosshair"
            )}
            style={{
              width: "100%",
              height: "600px",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Canvas Content */}
            <div
              className="absolute"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                background: `
                  linear-gradient(rgba(51, 65, 85, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(51, 65, 85, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            >
              {/* Stage Elements (Sahne, Catwalk, Sistem Kontrol) */}
              {stageElements.map((element) => (
                <StageItem key={element.id} element={element} />
              ))}

              {/* Regular Tables */}
              {regularTables.map((table) => (
                <TableItem
                  key={table.id}
                  table={table}
                  isSelected={selectedTableIds.includes(table.id)}
                  group={getTableGroup(table.id)}
                  assignedTeam={getAssignedTeam(table.id)}
                  assignedStaff={staffAssignments?.get(table.id)}
                  onClick={handleTableClick}
                />
              ))}

              {/* Locas */}
              {locas.map((loca) => (
                <LocaItem
                  key={loca.id}
                  loca={loca}
                  isSelected={selectedTableIds.includes(loca.id)}
                  group={getTableGroup(loca.id)}
                  assignedStaff={staffAssignments?.get(loca.id)}
                  onClick={handleTableClick}
                />
              ))}

              {/* Service Points - Locaların altında */}
              {showServicePoints &&
                servicePoints.map((sp) => (
                  <ServicePointItem
                    key={sp.id}
                    servicePoint={sp}
                    isSelected={selectedServicePointId === sp.id}
                    onClick={onServicePointClick}
                    onDoubleClick={onServicePointDoubleClick}
                  />
                ))}
            </div>

            {/* Lasso Selection Overlay */}
            <LassoOverlay
              isSelecting={isLassoSelecting}
              start={lassoStart}
              end={lassoEnd}
              zoom={zoom}
              offset={offset}
            />
          </div>
        )}

        {/* Empty State */}
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <p className="text-sm">Masa bulunamadı</p>
              <p className="text-xs mt-1">Önce alan planı oluşturun</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
