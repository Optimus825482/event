"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  forwardRef,
} from "react";
import {
  Search,
  X,
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  User,
  Phone,
  Users,
  Ticket,
} from "lucide-react";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";
import type {
  Event,
  Reservation,
  VenueLayout,
  CanvasTable,
  Zone,
} from "@/types";

// ─── Types ───────────────────────────────────────────────
interface ReservationViewCanvasProps {
  event: Event;
  reservations: Reservation[];
  onTableClick?: (tableId: string) => void;
  onCancelReservation?: (reservationId: string) => void;
  onViewReservationDetail?: (reservationId: string) => void;
  viewMode?: "2d" | "3d";
  externalHighlightTableId?: string | null;
}

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  onSelect: (table: any) => void;
  onDirectSearch: () => void;
  reservations: Reservation[];
}

// ─── Constants ───────────────────────────────────────────
const STATUS_COLORS: Record<
  string,
  { color: string; border: string; label: string }
> = {
  confirmed: { color: "#DC2626", border: "#F87171", label: "Onaylı" },
  pending: { color: "#D97706", border: "#FBBF24", label: "Beklemede" },
  checked_in: { color: "#2563EB", border: "#60A5FA", label: "Giriş Yapıldı" },
  available: { color: "#059669", border: "#34D399", label: "Boş" },
};

const CANVAS_WIDTH = 1050;
const CANVAS_HEIGHT = 680;

// ─── Helpers ─────────────────────────────────────────────
function getTableStatus(tableId: string, reservations: Reservation[]) {
  const r = reservations.find(
    (res) =>
      res.tableId === tableId &&
      res.status !== "cancelled" &&
      res.status !== "no_show",
  );
  if (!r)
    return { status: "available", reservation: null as Reservation | null };
  return { status: r.status, reservation: r };
}

function getTableLabel(table: any): string {
  if (table.isLoca && table.locaName) return table.locaName;
  if (table.label) return table.label;
  if (table.tableNumber !== undefined) return String(table.tableNumber);
  const p = (table.id || "").split("-");
  return p[p.length - 1];
}

// ─── SearchBar Component ─────────────────────────────────
const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      searchQuery,
      setSearchQuery,
      searchResults,
      onSelect,
      onDirectSearch,
      reservations,
    },
    ref,
  ) {
    return (
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={ref}
          type="text"
          placeholder="Masa veya misafir ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onDirectSearch();
          }}
          className="w-full pl-9 pr-8 h-9 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
            {searchResults.map((table: any) => {
              const { status, reservation } = getTableStatus(
                table.id,
                reservations,
              );
              const colors = STATUS_COLORS[status] || STATUS_COLORS.available;
              return (
                <button
                  key={table.id}
                  onClick={() => onSelect(table)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: colors.color }}
                  >
                    {table.isLoca ? table.locaName : table.tableNumber}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {table.isLoca
                        ? `Loca ${table.locaName}`
                        : `Masa ${table.tableNumber}`}
                    </p>
                    {reservation && (
                      <p className="text-xs text-slate-400 truncate">
                        {reservation.customer?.fullName ||
                          reservation.guestName ||
                          "Misafir"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors.color }}
                    />
                    <span className="text-[10px] text-slate-400">
                      {colors.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

// ─── Main Component ──────────────────────────────────────
export function ReservationViewCanvas({
  event,
  reservations,
  onTableClick,
  onCancelReservation,
  onViewReservationDetail,
  viewMode = "2d",
  externalHighlightTableId,
}: ReservationViewCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(0.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [fitZoom, setFitZoom] = useState(0.5);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(
    null,
  );

  // Combine internal highlight with external (from NewReservationModal)
  const effectiveHighlightId = externalHighlightTableId || highlightedTableId;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPopup, setSelectedPopup] = useState<{
    table: any;
    reservation: Reservation | null;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    table: any;
    reservation: Reservation;
  } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<{
    reservation: Reservation;
    table: any;
  } | null>(null);

  // Extract layout data
  const rawLayout = event.venueLayout as any;
  const layoutData = rawLayout?.layoutData || rawLayout;
  const tables: any[] = useMemo(
    () =>
      layoutData?.placedTables ||
      layoutData?.tables ||
      rawLayout?.tables ||
      rawLayout?.placedTables ||
      [],
    [layoutData, rawLayout],
  );
  const stageElements: any[] = useMemo(
    () => layoutData?.stageElements || rawLayout?.stageElements || [],
    [layoutData, rawLayout],
  );
  const zones: any[] = useMemo(
    () => layoutData?.zones || rawLayout?.zones || [],
    [layoutData, rawLayout],
  );
  const walls: any[] = useMemo(
    () => layoutData?.walls || rawLayout?.walls || [],
    [layoutData, rawLayout],
  );
  const lw =
    layoutData?.dimensions?.width ||
    layoutData?.width ||
    rawLayout?.width ||
    CANVAS_WIDTH;
  const lh =
    layoutData?.dimensions?.height ||
    layoutData?.height ||
    rawLayout?.height ||
    CANVAS_HEIGHT;

  // Fit-to-view: container boyutuna göre zoom hesapla
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || viewMode !== "2d") return;

    const calcFit = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;
      const padding = 10;
      const scaleX = (cw - padding) / lw;
      const scaleY = (ch - padding) / lh;
      const fit = Math.min(scaleX, scaleY);
      const clamped = Math.max(0.6, Math.min(fit, 2));
      setFitZoom(clamped);
      setZoom(clamped);
      setPanOffset({ x: 0, y: 0 });
    };

    calcFit();
    const observer = new ResizeObserver(calcFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [lw, lh, viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setHighlightedTableId(null);
        setSelectedPopup(null);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return tables
      .filter((t: any) => {
        if (String(t.tableNumber) === q || String(t.tableNumber).includes(q))
          return true;
        if (t.locaName?.toLowerCase().includes(q)) return true;
        const { reservation } = getTableStatus(t.id, reservations);
        if (reservation) {
          const name = (
            reservation.customer?.fullName ||
            reservation.guestName ||
            ""
          ).toLowerCase();
          if (name.includes(q)) return true;
        }
        return false;
      })
      .sort((a: any, b: any) => {
        if (String(a.tableNumber) === q) return -1;
        if (String(b.tableNumber) === q) return 1;
        return (a.tableNumber || 0) - (b.tableNumber || 0);
      })
      .slice(0, 12);
  }, [searchQuery, tables, reservations]);

  const handleTableSelect = useCallback(
    (table: any) => {
      setHighlightedTableId(table.id);
      setSearchQuery("");
      const { reservation } = getTableStatus(table.id, reservations);
      setSelectedPopup({ table, reservation });
      onTableClick?.(table.id);
    },
    [reservations, onTableClick],
  );

  const handleTableContextMenu = useCallback(
    (e: React.MouseEvent, table: any) => {
      e.preventDefault();
      e.stopPropagation();
      const { reservation } = getTableStatus(table.id, reservations);
      if (
        reservation &&
        reservation.status !== "cancelled" &&
        reservation.status !== "checked_in"
      ) {
        setContextMenu({ x: e.clientX, y: e.clientY, table, reservation });
        setSelectedPopup(null);
      }
    },
    [reservations],
  );

  const handleDirectSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    const exact = tables.find(
      (t: any) => String(t.tableNumber) === q || t.locaName === q,
    );
    if (exact) handleTableSelect(exact);
    else if (searchResults.length > 0) handleTableSelect(searchResults[0]);
  }, [searchQuery, tables, searchResults, handleTableSelect]);

  // Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== "2d") return;
    if (selectedPopup) setSelectedPopup(null);
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || viewMode !== "2d") return;
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const zoomOut = () =>
    setZoom((z) => Math.max(z - 0.2, Math.max(0.3, fitZoom - 0.2)));
  const zoomReset = () => {
    setZoom(fitZoom);
    setPanOffset({ x: 0, y: 0 });
  };

  // 3D data
  const venueLayout3D: VenueLayout = useMemo(
    () => ({
      width: lw,
      height: lh,
      tables: [],
      gridSize: 38,
      walls: walls.map((w: any) => ({
        id: w.id,
        points: w.points || [],
        strokeWidth: w.strokeWidth || 4,
        color: w.color || "#64748b",
        label: w.label,
      })),
      zones: [
        ...zones.map((z: any) => ({
          id: z.id,
          type: (z.type || "other") as Zone["type"],
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          label: z.label || "",
          color: z.color || "#334155",
        })),
        ...stageElements.map((el: any) => ({
          id: el.id,
          type: (el.type === "stage"
            ? "stage"
            : el.type === "system_control"
              ? "system"
              : "stage-extension") as Zone["type"],
          x: el.x,
          y: el.y,
          width: el.width || 120,
          height: el.height || 60,
          label: el.label || el.displayText || "",
          color: el.color || (el.type === "stage" ? "#1e3a5f" : "#334155"),
        })),
      ],
    }),
    [lw, lh, walls, zones, stageElements],
  );

  const tables3D: CanvasTable[] = useMemo(
    () =>
      tables.map((t: any) => {
        const { status } = getTableStatus(t.id, reservations);
        const c = STATUS_COLORS[status] || STATUS_COLORS.available;
        const isLoca = t.isLoca === true;
        return {
          id: t.id,
          typeId: isLoca ? "loca" : t.type || "standard",
          typeName: isLoca ? "Loca" : "Masa",
          x: t.x,
          y: t.y,
          rotation: t.rotation || 0,
          capacity: t.capacity || (isLoca ? 10 : 4),
          color: c.color,
          staffColor: c.color,
          shape: isLoca ? ("rectangle" as const) : ("round" as const),
          label: getTableLabel(t),
          status:
            status === "available"
              ? ("available" as const)
              : ("reserved" as const),
        };
      }),
    [tables, reservations],
  );

  // Stats
  const stats = useMemo(() => {
    const normal = tables.filter((t: any) => !t.isLoca).length;
    const locas = tables.filter((t: any) => t.isLoca).length;
    const reserved = tables.filter(
      (t: any) => getTableStatus(t.id, reservations).status !== "available",
    ).length;
    return { tables: normal, locas, reserved };
  }, [tables, reservations]);

  // Sahne merkez pozisyonu — bilgi kartı sahne üzerinde açılacak
  const stageCenter = useMemo(() => {
    const stage = stageElements.find(
      (el: any) =>
        el.type === "stage" || (el.label || "").toLowerCase().includes("sahne"),
    );
    if (stage) {
      return {
        x: stage.x + (stage.width || 120) / 2,
        y: stage.y + (stage.height || 60) / 2,
        width: stage.width || 120,
        height: stage.height || 60,
      };
    }
    // Fallback: canvas üst-orta
    return { x: lw / 2, y: 60, width: 120, height: 60 };
  }, [stageElements, lw]);

  // ─── 3D View ───
  if (viewMode === "3d") {
    return (
      <div className="w-full h-full relative">
        <Canvas3DPreview
          layout={venueLayout3D}
          tables={tables3D}
          selectedTableIds={effectiveHighlightId ? [effectiveHighlightId] : []}
          onTableClick={(id) => {
            const t = tables.find((tb: any) => tb.id === id);
            if (t) handleTableSelect(t);
          }}
        />
        <div className="absolute top-3 left-3 z-10">
          <SearchBar
            ref={searchInputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSelect={handleTableSelect}
            onDirectSearch={handleDirectSearch}
            reservations={reservations}
          />
        </div>
      </div>
    );
  }

  // ─── 2D View ───
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-900 rounded-lg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/50">
          <button
            onClick={zoomOut}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-cyan-400 font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomReset}
            className="p-1.5 text-slate-400 hover:text-white transition-colors border-l border-slate-600/50"
            aria-label="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1 bg-slate-700/30 px-2 py-1 rounded">
            <MapPin className="w-3 h-3 text-blue-400" />
            {stats.tables} masa
          </span>
          <span className="flex items-center gap-1 bg-slate-700/30 px-2 py-1 rounded">
            <MapPin className="w-3 h-3 text-pink-400" />
            {stats.locas} loca
          </span>
          <span className="flex items-center gap-1 bg-slate-700/30 px-2 py-1 rounded">
            <Ticket className="w-3 h-3 text-red-400" />
            {stats.reserved} dolu
          </span>
        </div>

        <div className="ml-auto">
          <SearchBar
            ref={searchInputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSelect={handleTableSelect}
            onDirectSearch={handleDirectSearch}
            reservations={reservations}
          />
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 overflow-auto relative"
        style={{
          background:
            "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
        }}
      >
        <div
          className="min-w-full min-h-full flex items-center justify-center p-8"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            cursor: isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="relative bg-slate-800/50 rounded-2xl border border-slate-700 shadow-2xl"
            style={{ width: lw * zoom * 1.15, height: lh * zoom * 1.15 }}
          >
            {/* Grid */}
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(71,85,105,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(71,85,105,0.2) 1px, transparent 1px)`,
                backgroundSize: `${38 * zoom}px ${38 * zoom}px`,
              }}
            />

            {/* Stage elements (barlar hariç) */}
            {stageElements
              .filter((el: any) => {
                const label = (el.label || el.displayText || "").toLowerCase();
                return !label.includes("bar");
              })
              .map((el: any) => (
                <div
                  key={el.id}
                  className="absolute flex items-center justify-center text-white font-bold rounded-lg shadow-lg"
                  style={{
                    left: el.x * zoom * 1.15,
                    top: el.y * zoom * 1.15,
                    width: (el.width || 50) * zoom * 1.15,
                    height: (el.height || 60) * zoom * 1.15,
                    backgroundColor:
                      el.type === "stage"
                        ? "#3b82f6"
                        : el.type === "system_control"
                          ? "#f59e0b"
                          : "#8b5cf6",
                    fontSize: Math.max(10, 14 * zoom),
                  }}
                >
                  {el.label || el.displayText || el.type?.toUpperCase()}
                </div>
              ))}

            {/* Normal tables */}
            {tables
              .filter((t: any) => !t.isLoca)
              .map((table: any) => {
                const hl = effectiveHighlightId === table.id;
                const isExternal = externalHighlightTableId === table.id;
                const { status } = getTableStatus(table.id, reservations);
                const c = STATUS_COLORS[status] || STATUS_COLORS.available;
                const baseSz =
                  table.capacity >= 12 ? 46 : table.capacity >= 8 ? 42 : 38;
                const sz = baseSz * zoom;
                const fontSize = Math.max(11, 15 * zoom);
                return (
                  <div
                    key={table.id}
                    className={`absolute flex items-center justify-center rounded-full text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${hl ? "z-30" : "z-10"}`}
                    style={{
                      left: table.x * zoom * 1.15,
                      top: table.y * zoom * 1.15,
                      width: sz,
                      height: sz,
                      background: hl
                        ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                        : `radial-gradient(circle at 35% 35%, ${c.color}ee, ${c.color}99)`,
                      border: hl
                        ? "3px solid #22d3ee"
                        : `2px solid ${c.border}`,
                      fontSize,
                      letterSpacing: "0.5px",
                      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                      boxShadow: hl
                        ? `0 0 0 4px rgba(34,211,238,0.8), 0 0 30px rgba(34,211,238,0.6)`
                        : `0 4px 14px ${c.color}50, inset 0 1px 0 rgba(255,255,255,0.15)`,
                      transform: hl ? "scale(1.3)" : "scale(1)",
                      animation: isExternal
                        ? "rvExternalPulse 2s infinite"
                        : hl
                          ? "rvPulse 1s infinite"
                          : "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTableSelect(table);
                    }}
                    onContextMenu={(e) => handleTableContextMenu(e, table)}
                  >
                    {table.tableNumber}
                    {/* External highlight: checkmark badge */}
                    {isExternal && (
                      <div
                        className="absolute flex items-center justify-center bg-cyan-500 rounded-full border-2 border-white shadow-lg"
                        style={{
                          width: Math.max(14, 18 * zoom),
                          height: Math.max(14, 18 * zoom),
                          top: -Math.max(6, 8 * zoom),
                          right: -Math.max(6, 8 * zoom),
                          fontSize: Math.max(8, 11 * zoom),
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Loca tables — farklı renk, daha büyük */}
            {tables
              .filter((t: any) => t.isLoca)
              .map((loca: any) => {
                const hl = effectiveHighlightId === loca.id;
                const isExternal = externalHighlightTableId === loca.id;
                const { status } = getTableStatus(loca.id, reservations);
                const locaAvailable = status === "available";
                const w = 72 * zoom;
                const h = 36 * zoom;
                return (
                  <div
                    key={loca.id}
                    className={`absolute flex items-center justify-center rounded-xl text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${hl ? "z-30" : "z-10"}`}
                    style={{
                      left: loca.x * zoom * 1.15,
                      top: loca.y * zoom * 1.15,
                      width: w,
                      height: h,
                      background: hl
                        ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                        : locaAvailable
                          ? "linear-gradient(135deg, #a855f7, #7c3aed)"
                          : "linear-gradient(135deg, #dc2626ee, #b91c1c99)",
                      border: hl
                        ? "3px solid #22d3ee"
                        : locaAvailable
                          ? "2px solid #c084fc"
                          : "2px solid #f87171",
                      fontSize: Math.max(10, 13 * zoom),
                      letterSpacing: "0.5px",
                      textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                      boxShadow: hl
                        ? `0 0 0 4px rgba(34,211,238,0.8), 0 0 30px rgba(34,211,238,0.6)`
                        : locaAvailable
                          ? `0 4px 16px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`
                          : `0 4px 16px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
                      transform: hl ? "scale(1.3)" : "scale(1)",
                      animation: isExternal
                        ? "rvExternalPulse 2s infinite"
                        : hl
                          ? "rvPulse 1s infinite"
                          : "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTableSelect(loca);
                    }}
                    onContextMenu={(e) => handleTableContextMenu(e, loca)}
                  >
                    {loca.locaName || `L${loca.tableNumber}`}
                    {/* External highlight: checkmark badge */}
                    {isExternal && (
                      <div
                        className="absolute flex items-center justify-center bg-cyan-500 rounded-full border-2 border-white shadow-lg"
                        style={{
                          width: Math.max(14, 18 * zoom),
                          height: Math.max(14, 18 * zoom),
                          top: -Math.max(6, 8 * zoom),
                          right: -Math.max(6, 8 * zoom),
                          fontSize: Math.max(8, 11 * zoom),
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}

            {/* SVG ok çizgisi: masadan sahneye */}
            {selectedPopup &&
              (() => {
                const tbl = selectedPopup.table;
                const isLoca = tbl.isLoca;
                const tblSz = isLoca
                  ? 72
                  : tbl.capacity >= 12
                    ? 46
                    : tbl.capacity >= 8
                      ? 42
                      : 38;
                const tableX =
                  tbl.x * zoom * 1.15 +
                  (isLoca ? (72 * zoom) / 2 : (tblSz * zoom) / 2);
                const tableY =
                  tbl.y * zoom * 1.15 +
                  (isLoca ? (36 * zoom) / 2 : (tblSz * zoom) / 2);
                const stageX = stageCenter.x * zoom * 1.15;
                const stageY =
                  (stageCenter.y + stageCenter.height / 2 + 10) * zoom * 1.15;
                return (
                  <svg
                    className="absolute inset-0 z-40 pointer-events-none"
                    style={{
                      width: "100%",
                      height: "100%",
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <marker
                        id="rvArrowHead"
                        markerWidth="8"
                        markerHeight="6"
                        refX="8"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 3, 0 6" fill="#22d3ee" />
                      </marker>
                      <linearGradient
                        id="rvArrowGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#22d3ee"
                          stopOpacity="0.9"
                        />
                        <stop
                          offset="100%"
                          stopColor="#06b6d4"
                          stopOpacity="0.5"
                        />
                      </linearGradient>
                    </defs>
                    <line
                      x1={tableX}
                      y1={tableY}
                      x2={stageX}
                      y2={stageY}
                      stroke="url(#rvArrowGrad)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      markerEnd="url(#rvArrowHead)"
                      className="rvArrowLine"
                    />
                    <circle
                      cx={tableX}
                      cy={tableY}
                      r="4"
                      fill="#22d3ee"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="r"
                        values="4;7;4"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0.8"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </svg>
                );
              })()}

            {/* Bilgi kartı — sahne üzerinde */}
            {selectedPopup &&
              (() => {
                const tbl = selectedPopup.table;
                const res = selectedPopup.reservation;
                const { status } = getTableStatus(tbl.id, reservations);
                const c = STATUS_COLORS[status] || STATUS_COLORS.available;
                const cardX = stageCenter.x * zoom * 1.15;
                const cardY =
                  (stageCenter.y + stageCenter.height / 2 + 16) * zoom * 1.15;
                return (
                  <div
                    className="absolute z-50 rvCardAppear"
                    style={{
                      left: cardX,
                      top: cardY,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div
                      className="bg-slate-900/95 border-2 rounded-xl p-4 shadow-2xl backdrop-blur-sm min-w-[220px] max-w-[300px]"
                      style={{
                        borderColor: c.border,
                        boxShadow: `0 0 30px ${c.color}40, 0 8px 32px rgba(0,0,0,0.5)`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-white font-bold text-sm">
                            {tbl.isLoca
                              ? `Loca ${tbl.locaName}`
                              : `Masa ${tbl.tableNumber}`}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPopup(null);
                            setHighlightedTableId(null);
                          }}
                          className="p-1 hover:bg-slate-700 rounded-full transition-colors"
                        >
                          <X className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Durum</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: c.color }}
                        >
                          {c.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Kapasite</span>
                        <span className="text-xs text-slate-200">
                          {tbl.capacity || (tbl.isLoca ? 10 : 4)} kişi
                        </span>
                      </div>
                      {res && (
                        <div className="border-t border-slate-700 pt-2 mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-white">
                              {res.customer?.fullName ||
                                res.guestName ||
                                "Misafir"}
                            </span>
                          </div>
                          {(res.customer?.phone || res.guestPhone) && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-300">
                                {res.customer?.phone || res.guestPhone}
                              </span>
                            </div>
                          )}
                          {res.guestCount && (
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-300">
                                {res.guestCount} kişi
                              </span>
                            </div>
                          )}
                          {(res as any).notes && (
                            <div className="mt-1 p-2 bg-slate-800/50 rounded text-xs text-slate-300">
                              {(res as any).notes}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewReservationDetail?.(res.id);
                            }}
                            className="mt-2 w-full py-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Detay Gör
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-xs text-slate-400 truncate">
              {contextMenu.reservation.customer?.fullName ||
                contextMenu.reservation.guestName ||
                "Misafir"}
            </p>
            <p className="text-[10px] text-slate-500">
              {contextMenu.table.isLoca
                ? `Loca ${contextMenu.table.locaName}`
                : `Masa ${contextMenu.table.tableNumber}`}
            </p>
          </div>
          <button
            onClick={() => {
              setCancelConfirm({
                reservation: contextMenu.reservation,
                table: contextMenu.table,
              });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-4 h-4" />
            Rezervasyonu İptal Et
          </button>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancelConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCancelConfirm(null)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  Rezervasyonu İptal Et
                </h3>
                <p className="text-xs text-slate-400">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3 mb-4 space-y-1">
              <p className="text-sm text-white font-medium">
                {cancelConfirm.reservation.customer?.fullName ||
                  cancelConfirm.reservation.guestName ||
                  "Misafir"}
              </p>
              <p className="text-xs text-slate-400">
                {cancelConfirm.table.isLoca
                  ? `Loca ${cancelConfirm.table.locaName}`
                  : `Masa ${cancelConfirm.table.tableNumber}`}{" "}
                • {cancelConfirm.reservation.guestCount} kişi
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(null)}
                className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  onCancelReservation?.(cancelConfirm.reservation.id);
                  setCancelConfirm(null);
                }}
                className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/80 border-t border-slate-700/50 flex-shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          Durum:
        </span>
        {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            <span className="text-xs text-slate-400">{cfg.label}</span>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes rvPulse {
          0%,
          100% {
            box-shadow:
              0 0 0 4px rgba(34, 211, 238, 0.8),
              0 0 30px rgba(34, 211, 238, 0.6);
            opacity: 1;
          }
          50% {
            box-shadow:
              0 0 0 12px rgba(34, 211, 238, 0.2),
              0 0 60px rgba(34, 211, 238, 0.9);
            opacity: 0.7;
          }
        }
        @keyframes rvExternalPulse {
          0%,
          100% {
            box-shadow:
              0 0 0 3px rgba(34, 211, 238, 0.6),
              0 0 20px rgba(34, 211, 238, 0.4);
          }
          50% {
            box-shadow:
              0 0 0 6px rgba(34, 211, 238, 0.3),
              0 0 35px rgba(34, 211, 238, 0.6);
          }
        }
        .rvArrowLine {
          stroke-dashoffset: 20;
          animation: rvDash 1s linear infinite;
        }
        @keyframes rvDash {
          to {
            stroke-dashoffset: 0;
          }
        }
        .rvCardAppear {
          animation: rvCardIn 0.3s ease-out both;
        }
        @keyframes rvCardIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
