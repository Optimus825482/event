"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  X,
  Eye,
  Box,
  Users,
  MapPin,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";
import { VenueLayout, CanvasTable, Zone } from "@/types";

// ==================== TYPES ====================
interface PlacedTable {
  id: string;
  tableNumber: number;
  type: string;
  capacity: number;
  x: number;
  y: number;
  isLoca: boolean;
  locaName?: string;
}

interface StageElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venueLayout?: {
    placedTables?: PlacedTable[];
    stageElements?: StageElement[];
  };
}

// ==================== CONSTANTS ====================
const TABLE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  unassigned: { label: "Atanmamış", color: "#6b7280" },
  standard: { label: "Standart", color: "#3b82f6" },
  premium: { label: "Premium", color: "#8b5cf6" },
  vip: { label: "VIP", color: "#f59e0b" },
  loca: { label: "Loca", color: "#ec4899" },
};

const CANVAS_WIDTH = 1050;
const CANVAS_HEIGHT = 680;

// ==================== MAIN COMPONENT ====================
export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(
    null
  );

  // Data
  const [placedTables, setPlacedTables] = useState<PlacedTable[]>([]);
  const [stageElements, setStageElements] = useState<StageElement[]>([]);

  // Fetch event data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await eventsApi.getOne(eventId);
        setEvent(res.data);

        if (res.data?.venueLayout) {
          const layout = res.data.venueLayout;
          if (layout.placedTables) setPlacedTables(layout.placedTables);
          if (layout.stageElements) setStageElements(layout.stageElements);
        }
      } catch (error) {
        console.error("Event fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();

    return placedTables
      .filter((table) => {
        // Masa numarası ile ara
        if (table.tableNumber.toString().includes(query)) return true;
        // Loca ismi ile ara
        if (table.locaName?.toLowerCase().includes(query)) return true;
        // Tip ile ara
        if (table.type.toLowerCase().includes(query)) return true;
        return false;
      })
      .slice(0, 10); // Max 10 sonuç
  }, [searchQuery, placedTables]);

  // Handle table select from search
  const handleTableSelect = useCallback((table: PlacedTable) => {
    setHighlightedTableId(table.id);
    setSearchQuery("");

    // 3 saniye sonra highlight'ı kaldır
    setTimeout(() => {
      setHighlightedTableId(null);
    }, 5000);
  }, []);

  // Convert to VenueLayout format for 3D
  const venueLayout: VenueLayout = useMemo(() => {
    const zones: Zone[] = stageElements.map((el) => ({
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
          ? "#1e3a5f"
          : el.type === "system_control"
          ? "#78350f"
          : "#334155",
    }));

    return {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      zones,
      tables: [],
      walls: [],
      gridSize: 38,
    };
  }, [stageElements]);

  // Convert tables to CanvasTable format for 3D
  const canvasTables: CanvasTable[] = useMemo(() => {
    return placedTables.map((table) => ({
      id: table.id,
      label: table.isLoca
        ? table.locaName || `L${table.tableNumber}`
        : `${table.tableNumber}`,
      x: table.x,
      y: table.y,
      capacity: table.capacity,
      type: table.type,
      typeId: table.type,
      typeName: TABLE_TYPE_CONFIG[table.type]?.label || table.type,
      color: TABLE_TYPE_CONFIG[table.type]?.color || "#6b7280",
      rotation: 0,
      shape: table.isLoca ? "rectangle" : "round",
    }));
  }, [placedTables]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Fullscreen toggle
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-900 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Event Info */}
          <div className="flex items-center gap-3">
            {!isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-semibold text-white">
                {event?.name}
              </h1>
              <p className="text-xs text-slate-400">Check-in Görünümü</p>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Masa numarası ara... (örn: 42, VIP, Loca 3A)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-lg h-12"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchResults.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{
                        backgroundColor:
                          TABLE_TYPE_CONFIG[table.type]?.color || "#6b7280",
                      }}
                    >
                      {table.isLoca ? table.locaName : table.tableNumber}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium">
                        {table.isLoca
                          ? `Loca ${table.locaName}`
                          : `Masa ${table.tableNumber}`}
                      </p>
                      <p className="text-sm text-slate-400">
                        {TABLE_TYPE_CONFIG[table.type]?.label} •{" "}
                        {table.capacity} Kişilik
                      </p>
                    </div>
                    <MapPin className="w-5 h-5 text-cyan-400 ml-auto" />
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-4 text-center">
                <p className="text-slate-400">
                  "{searchQuery}" için sonuç bulunamadı
                </p>
              </div>
            )}
          </div>

          {/* Right: View Toggle + Controls */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === "2d"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-4 h-4" />
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === "3d"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Box className="w-4 h-4" />
                3D
              </button>
            </div>

            {/* Zoom Controls (2D only) */}
            {viewMode === "2d" && (
              <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-slate-400 hover:text-white"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Toplam Masa:</span>
            <span className="text-white font-medium">
              {placedTables.filter((t) => !t.isLoca).length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Loca:</span>
            <span className="text-white font-medium">
              {placedTables.filter((t) => t.isLoca).length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Toplam Kapasite:</span>
            <span className="text-white font-medium">
              {placedTables.reduce((sum, t) => sum + t.capacity, 0)} Kişi
            </span>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto p-4"
        style={{
          height: isFullscreen ? "calc(100vh - 120px)" : "calc(100vh - 180px)",
        }}
      >
        {viewMode === "2d" ? (
          /* 2D View */
          <div
            className="mx-auto bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            style={{
              width: CANVAS_WIDTH * zoom,
              height: CANVAS_HEIGHT * zoom,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <div
              className="relative"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
              {/* Grid Background */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(71, 85, 105, 0.3) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(71, 85, 105, 0.3) 1px, transparent 1px)
                  `,
                  backgroundSize: "38px 38px",
                }}
              />

              {/* Stage Elements */}
              {stageElements.map((element) => (
                <div
                  key={element.id}
                  className="absolute flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    backgroundColor:
                      element.type === "stage"
                        ? "#3b82f6"
                        : element.type === "system_control"
                        ? "#f59e0b"
                        : "#8b5cf6",
                    borderRadius: 4,
                  }}
                >
                  {element.label}
                </div>
              ))}

              {/* Tables */}
              {placedTables
                .filter((t) => !t.isLoca)
                .map((table) => {
                  const isHighlighted = highlightedTableId === table.id;
                  const config =
                    TABLE_TYPE_CONFIG[table.type] ||
                    TABLE_TYPE_CONFIG.unassigned;

                  return (
                    <div
                      key={table.id}
                      className={`absolute flex items-center justify-center rounded-full text-white font-bold text-xs transition-all duration-300 ${
                        isHighlighted
                          ? "ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-800 scale-125 z-20"
                          : ""
                      }`}
                      style={{
                        left: table.x,
                        top: table.y,
                        width: 32,
                        height: 32,
                        backgroundColor: config.color,
                        boxShadow: isHighlighted
                          ? "0 0 20px rgba(34, 211, 238, 0.8)"
                          : "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      {table.tableNumber}
                    </div>
                  );
                })}

              {/* Locas */}
              {placedTables
                .filter((t) => t.isLoca)
                .map((loca) => {
                  const isHighlighted = highlightedTableId === loca.id;

                  return (
                    <div
                      key={loca.id}
                      className={`absolute flex items-center justify-center rounded text-white font-bold text-[8px] transition-all duration-300 ${
                        isHighlighted
                          ? "ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-800 scale-125 z-20"
                          : ""
                      }`}
                      style={{
                        left: loca.x,
                        top: loca.y,
                        width: 48,
                        height: 24,
                        backgroundColor: TABLE_TYPE_CONFIG.loca.color,
                        boxShadow: isHighlighted
                          ? "0 0 20px rgba(34, 211, 238, 0.8)"
                          : "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      {loca.locaName}
                    </div>
                  );
                })}

              {/* Highlighted Table Indicator */}
              {highlightedTableId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg z-30 animate-pulse">
                  <span className="font-medium">
                    {(() => {
                      const table = placedTables.find(
                        (t) => t.id === highlightedTableId
                      );
                      if (!table) return "";
                      return table.isLoca
                        ? `Loca ${table.locaName}`
                        : `Masa ${table.tableNumber}`;
                    })()}
                  </span>
                  <span className="text-cyan-200 ml-2">← Burada</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3D View */
          <div
            className="mx-auto rounded-lg overflow-hidden"
            style={{
              height: isFullscreen
                ? "calc(100vh - 140px)"
                : "calc(100vh - 200px)",
            }}
          >
            <Canvas3DPreview
              layout={venueLayout}
              tables={canvasTables}
              selectedTableIds={highlightedTableId ? [highlightedTableId] : []}
              onTableClick={(tableId) => {
                setHighlightedTableId(tableId);
                setTimeout(() => setHighlightedTableId(null), 5000);
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 bg-slate-800/90 border border-slate-700 rounded-lg p-3 z-40">
        <p className="text-xs text-slate-400 mb-2">Masa Tipleri</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TABLE_TYPE_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-xs text-slate-300">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
