"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  X,
  Eye,
  Box,
  Users,
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calendar,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
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
const TABLE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; borderColor: string }
> = {
  unassigned: { label: "Atanmamış", color: "#6b7280", borderColor: "#9ca3af" },
  standard: { label: "Standart", color: "#3b82f6", borderColor: "#60a5fa" },
  premium: { label: "Premium", color: "#8b5cf6", borderColor: "#a78bfa" },
  vip: { label: "VIP", color: "#f59e0b", borderColor: "#fbbf24" },
  loca: { label: "Loca", color: "#ec4899", borderColor: "#f472b6" },
};

const CANVAS_WIDTH = 1050;
const CANVAS_HEIGHT = 680;

// ==================== MAIN COMPONENT ====================
export default function CheckInLayoutPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1.2);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(
    null
  );
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

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

  // Keyboard shortcut for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setHighlightedTableId(null);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    return placedTables
      .filter((table) => {
        if (table.tableNumber.toString() === query) return true;
        if (table.tableNumber.toString().includes(query)) return true;
        if (table.locaName?.toLowerCase().includes(query)) return true;
        if (table.type.toLowerCase().includes(query)) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.tableNumber.toString() === query) return -1;
        if (b.tableNumber.toString() === query) return 1;
        return a.tableNumber - b.tableNumber;
      })
      .slice(0, 12);
  }, [searchQuery, placedTables]);

  // Handle table select from search
  const handleTableSelect = useCallback(
    (table: PlacedTable) => {
      setHighlightedTableId(table.id);
      setSearchQuery("");

      if (viewMode === "2d" && canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth;
        const containerHeight = canvasContainerRef.current.clientHeight;
        const targetX = -(table.x * zoom - containerWidth / 2);
        const targetY = -(table.y * zoom - containerHeight / 2);
        setPanOffset({ x: targetX, y: targetY });
      }

      setTimeout(() => setHighlightedTableId(null), 8000);
    },
    [viewMode, zoom]
  );

  // Direct search
  const handleDirectSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    const exactMatch = placedTables.find(
      (t) => t.tableNumber.toString() === query || t.locaName === query
    );

    if (exactMatch) {
      handleTableSelect(exactMatch);
    } else if (searchResults.length > 0) {
      handleTableSelect(searchResults[0]);
    }
  }, [searchQuery, placedTables, searchResults, handleTableSelect]);

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
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleZoomReset = () => {
    setZoom(1.2);
    setPanOffset({ x: 0, y: 0 });
  };

  // Stats
  const stats = useMemo(() => {
    const tables = placedTables.filter((t) => !t.isLoca);
    const locas = placedTables.filter((t) => t.isLoca);
    const totalCapacity = placedTables.reduce((sum, t) => sum + t.capacity, 0);
    return { tables: tables.length, locas: locas.length, totalCapacity };
  }, [placedTables]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Yerleşim planı yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Back + Event Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/check-in")}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-400" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{event?.name}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {event?.eventDate && formatDate(event.eventDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {event?.eventDate && formatTime(event.eventDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-xl relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Masa numarası ara... (/ veya Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDirectSearch();
                }}
                className="pl-12 pr-12 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-xl h-14 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                {searchResults.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                      style={{
                        backgroundColor:
                          TABLE_TYPE_CONFIG[table.type]?.color || "#6b7280",
                      }}
                    >
                      {table.isLoca ? table.locaName : table.tableNumber}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-white font-semibold text-lg">
                        {table.isLoca
                          ? `Loca ${table.locaName}`
                          : `Masa ${table.tableNumber}`}
                      </p>
                      <p className="text-sm text-slate-400">
                        {TABLE_TYPE_CONFIG[table.type]?.label} •{" "}
                        {table.capacity} Kişilik
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-cyan-400">
                      <MapPin className="w-5 h-5" />
                      <span className="text-sm">Göster</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 p-6 text-center">
                <p className="text-slate-400 text-lg">
                  "{searchQuery}" için masa bulunamadı
                </p>
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.tables}</p>
                <p className="text-xs text-slate-400">Masa</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-pink-400">
                  {stats.locas}
                </p>
                <p className="text-xs text-slate-400">Loca</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">
                  {stats.totalCapacity}
                </p>
                <p className="text-xs text-slate-400">Kapasite</p>
              </div>
            </div>

            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === "2d"
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-5 h-5" />
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === "3d"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Box className="w-5 h-5" />
                3D
              </button>
            </div>

            {viewMode === "2d" && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-sm text-slate-400 w-14 text-center font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-2 text-slate-400 hover:text-white transition-colors border-l border-slate-700"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 overflow-auto relative"
        style={{
          background:
            "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
        }}
      >
        {viewMode === "2d" ? (
          <div
            className="min-w-full min-h-full flex items-center justify-center p-8"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}
          >
            <div
              className="relative bg-slate-800/50 rounded-2xl border border-slate-700 shadow-2xl"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom,
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(71, 85, 105, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(71, 85, 105, 0.2) 1px, transparent 1px)`,
                  backgroundSize: `${38 * zoom}px ${38 * zoom}px`,
                }}
              />

              {stageElements.map((element) => (
                <div
                  key={element.id}
                  className="absolute flex items-center justify-center text-white font-bold rounded-lg shadow-lg"
                  style={{
                    left: element.x * zoom,
                    top: element.y * zoom,
                    width: element.width * zoom,
                    height: element.height * zoom,
                    backgroundColor:
                      element.type === "stage"
                        ? "#3b82f6"
                        : element.type === "system_control"
                        ? "#f59e0b"
                        : "#8b5cf6",
                    fontSize: Math.max(10, 14 * zoom),
                  }}
                >
                  {element.label}
                </div>
              ))}

              {placedTables
                .filter((t) => !t.isLoca)
                .map((table) => {
                  const isHighlighted = highlightedTableId === table.id;
                  const config =
                    TABLE_TYPE_CONFIG[table.type] ||
                    TABLE_TYPE_CONFIG.unassigned;
                  const size = 32 * zoom;
                  return (
                    <div
                      key={table.id}
                      className={`absolute flex items-center justify-center rounded-full text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${
                        isHighlighted ? "z-30" : "z-10"
                      }`}
                      style={{
                        left: table.x * zoom,
                        top: table.y * zoom,
                        width: size,
                        height: size,
                        backgroundColor: config.color,
                        border: `2px solid ${config.borderColor}`,
                        fontSize: Math.max(8, 11 * zoom),
                        boxShadow: isHighlighted
                          ? `0 0 0 4px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.6)`
                          : `0 4px 12px ${config.color}40`,
                        transform: isHighlighted ? "scale(1.5)" : "scale(1)",
                        animation: isHighlighted ? "pulse 1s infinite" : "none",
                      }}
                      onClick={() => handleTableSelect(table)}
                    >
                      {table.tableNumber}
                    </div>
                  );
                })}

              {placedTables
                .filter((t) => t.isLoca)
                .map((loca) => {
                  const isHighlighted = highlightedTableId === loca.id;
                  const width = 48 * zoom;
                  const height = 24 * zoom;
                  return (
                    <div
                      key={loca.id}
                      className={`absolute flex items-center justify-center rounded-lg text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${
                        isHighlighted ? "z-30" : "z-10"
                      }`}
                      style={{
                        left: loca.x * zoom,
                        top: loca.y * zoom,
                        width,
                        height,
                        backgroundColor: TABLE_TYPE_CONFIG.loca.color,
                        border: `2px solid ${TABLE_TYPE_CONFIG.loca.borderColor}`,
                        fontSize: Math.max(7, 9 * zoom),
                        boxShadow: isHighlighted
                          ? `0 0 0 4px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.6)`
                          : `0 4px 12px ${TABLE_TYPE_CONFIG.loca.color}40`,
                        transform: isHighlighted ? "scale(1.5)" : "scale(1)",
                        animation: isHighlighted ? "pulse 1s infinite" : "none",
                      }}
                      onClick={() => handleTableSelect(loca)}
                    >
                      {loca.locaName}
                    </div>
                  );
                })}

              {highlightedTableId && (
                <div
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-40"
                  style={{ transform: `translateX(-50%) scale(${1 / zoom})` }}
                >
                  <div className="bg-cyan-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-3">
                    <MapPin className="w-6 h-6" />
                    <span className="font-bold text-lg">
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
                    <span className="text-cyan-200">← Burada</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <Canvas3DPreview
              layout={venueLayout}
              tables={canvasTables}
              selectedTableIds={highlightedTableId ? [highlightedTableId] : []}
              onTableClick={(tableId) => {
                setHighlightedTableId(tableId);
                setTimeout(() => setHighlightedTableId(null), 8000);
              }}
              entrancePosition={{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 }}
              showPath={!!highlightedTableId}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 bg-slate-800/95 border border-slate-700 rounded-xl p-4 z-40 backdrop-blur-sm">
        <p className="text-xs text-slate-400 mb-3 font-medium">MASA TİPLERİ</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {Object.entries(TABLE_TYPE_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full shadow-lg"
                style={{
                  backgroundColor: config.color,
                  boxShadow: `0 0 8px ${config.color}60`,
                }}
              />
              <span className="text-sm text-slate-300">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 bg-slate-800/95 border border-slate-700 rounded-xl px-4 py-2 z-40 backdrop-blur-sm">
        <p className="text-xs text-slate-500">
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">
            /
          </kbd>{" "}
          veya{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">
            Ctrl+K
          </kbd>{" "}
          ile ara •{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">
            Esc
          </kbd>{" "}
          ile kapat
        </p>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.8),
              0 0 30px rgba(34, 211, 238, 0.6);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(34, 211, 238, 0.4),
              0 0 50px rgba(34, 211, 238, 0.8);
          }
        }
      `}</style>
    </div>
  );
}
