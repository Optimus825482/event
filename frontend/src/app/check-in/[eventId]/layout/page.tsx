"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  X,
  Eye,
  Box,
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calendar,
  ArrowLeft,
  User,
  Check,
  Crosshair,
  Users,
  Crown,
} from "lucide-react";
import { eventsApi, staffApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";
import { VenueLayout, CanvasTable, Zone } from "@/types";

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

interface TableGroup {
  id: string;
  name: string;
  tableIds: string[];
  color?: string;
}

interface StaffAssignment {
  id: string;
  staffId: string;
  staffName: string;
  tableIds: string[];
}

interface TeamData {
  id: string;
  name: string;
  color: string;
  members: Array<{ id: string; name: string; role?: string }>;
  leaderId?: string;
  tableIds: string[];
}

interface TeamLeader {
  staffId: string;
  staffName: string;
  role?: string;
}

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

// Grup renkleri palette
const GROUP_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
  "#10b981",
  "#0ea5e9",
  "#6366f1",
];

export default function CheckInLayoutPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(
    null,
  );
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [placedTables, setPlacedTables] = useState<PlacedTable[]>([]);
  const [stageElements, setStageElements] = useState<StageElement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Personel konum işaretleme
  const [myPosition, setMyPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isSettingPosition, setIsSettingPosition] = useState(false);

  // Grup görünümü
  const [showGroupView, setShowGroupView] = useState(false);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>(
    [],
  );
  const [teams, setTeams] = useState<TeamData[]>([]);

  // Kamera sabit kalma ayarı
  const [lockCamera, setLockCamera] = useState(true);

  // Tıklanan masanın görevli bilgisi popup'ı
  const [selectedTablePopup, setSelectedTablePopup] = useState<{
    tableId: string;
    x: number;
    y: number;
    tableLabel: string;
    groupName: string;
    groupColor: string;
    staffNames: string[];
    teamName?: string;
    teamColor?: string;
    teamLeaders?: TeamLeader[];
  } | null>(null);

  // localStorage'dan konumu yükle
  useEffect(() => {
    const savedPosition = localStorage.getItem(`myPosition_${eventId}`);
    if (savedPosition) {
      try {
        setMyPosition(JSON.parse(savedPosition));
      } catch (e) {
        console.error("Position parse error:", e);
      }
    }
  }, [eventId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, groupsRes, assignmentsRes, teamsRes] =
          await Promise.all([
            eventsApi.getOne(eventId),
            staffApi.getEventTableGroups(eventId).catch(() => ({ data: [] })),
            staffApi
              .getEventStaffAssignments(eventId)
              .catch(() => ({ data: [] })),
            staffApi.getEventTeams(eventId).catch(() => ({ data: [] })),
          ]);

        setEvent(eventRes.data);
        if (eventRes.data?.venueLayout) {
          const layout = eventRes.data.venueLayout;
          if (layout.placedTables) setPlacedTables(layout.placedTables);
          if (layout.stageElements) setStageElements(layout.stageElements);
        }

        // Grupları ayarla
        if (groupsRes.data) {
          setTableGroups(
            groupsRes.data.map((g: any) => ({
              id: g.id,
              name: g.name,
              tableIds: g.tableIds || [],
              color: g.color,
            })),
          );
        }

        // Staff atamalarını ayarla
        if (assignmentsRes.data) {
          setStaffAssignments(
            assignmentsRes.data.map((a: any) => ({
              id: a.id,
              staffId: a.staffId,
              staffName: a.staffName || a.staff?.fullName || "Personel",
              tableIds: a.tableIds || [],
            })),
          );
        }

        // Takımları ayarla
        if (teamsRes.data) {
          setTeams(
            teamsRes.data.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              members: t.members || [],
              leaderId: t.leaderId,
              tableIds: t.tableIds || [],
            })),
          );
        }
      } catch (error) {
        console.error("Event fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return placedTables
      .filter((table) => {
        if (table.tableNumber.toString() === query) return true;
        if (table.tableNumber.toString().includes(query)) return true;
        if (table.locaName?.toLowerCase().includes(query)) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.tableNumber.toString() === query) return -1;
        if (b.tableNumber.toString() === query) return 1;
        return a.tableNumber - b.tableNumber;
      })
      .slice(0, 12);
  }, [searchQuery, placedTables]);

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

  // Masa -> Grup eşleştirmesi (canvasTables'dan önce tanımlanmalı)
  const tableToGroupMap = useMemo(() => {
    const map: Record<
      string,
      {
        groupName: string;
        groupColor: string;
        staffNames: string[];
        teamName?: string;
        teamColor?: string;
        teamLeaders?: TeamLeader[];
      }
    > = {};

    tableGroups.forEach((group, index) => {
      const groupColor =
        group.color || GROUP_COLORS[index % GROUP_COLORS.length];

      // Grup içindeki masalara atanmış personelleri bul
      const staffForGroup: string[] = [];
      staffAssignments.forEach((assignment) => {
        const hasCommonTable = assignment.tableIds.some((tid) =>
          group.tableIds.includes(tid),
        );
        if (hasCommonTable && !staffForGroup.includes(assignment.staffName)) {
          staffForGroup.push(assignment.staffName);
        }
      });

      // Bu gruba atanmış takımı bul
      let teamInfo: {
        name: string;
        color: string;
        leaders: TeamLeader[];
      } | null = null;
      const assignedTeam = teams.find((t) =>
        t.tableIds.some((tid) => group.tableIds.includes(tid)),
      );
      if (assignedTeam) {
        // Takım liderlerini bul
        const leaders: TeamLeader[] = assignedTeam.members
          .filter(
            (m) =>
              m.role === "captain" ||
              m.role === "supervisor" ||
              m.id === assignedTeam.leaderId,
          )
          .map((m) => ({
            staffId: m.id,
            staffName: m.name,
            role: m.role,
          }));

        teamInfo = {
          name: assignedTeam.name,
          color: assignedTeam.color,
          leaders,
        };
      }

      group.tableIds.forEach((tableLabel) => {
        // tableLabel "1", "96", "1001" (loca) gibi string
        // placedTables'da tableNumber (number) veya locaName ile eşleştir
        const tableNum = parseInt(tableLabel, 10);

        const matchingTable = placedTables.find((t) => {
          // Masa numarası ile eşleştir (hem number hem string)
          if (t.tableNumber === tableNum) return true;
          if (t.tableNumber.toString() === tableLabel) return true;
          // Loca adı ile eşleştir
          if (t.locaName === tableLabel) return true;
          // Tam ID ile eşleştir
          if (t.id === tableLabel) return true;
          return false;
        });

        if (matchingTable) {
          map[matchingTable.id] = {
            groupName: group.name,
            groupColor,
            staffNames: staffForGroup,
            teamName: teamInfo?.name,
            teamColor: teamInfo?.color,
            teamLeaders: teamInfo?.leaders,
          };
        }
      });
    });

    return map;
  }, [tableGroups, staffAssignments, placedTables, teams]);

  // handleTableSelect - tableToGroupMap'den sonra tanımlanmalı
  const handleTableSelect = useCallback(
    (table: PlacedTable) => {
      setHighlightedTableId(table.id);
      setSearchQuery("");

      // Grup görünümü açıksa ve masanın grup bilgisi varsa popup göster
      if (showGroupView) {
        const groupInfo = tableToGroupMap[table.id];
        if (groupInfo) {
          setSelectedTablePopup({
            tableId: table.id,
            x: table.x,
            y: table.y,
            tableLabel: table.isLoca
              ? table.locaName || `L${table.tableNumber}`
              : `Masa ${table.tableNumber}`,
            groupName: groupInfo.groupName,
            groupColor: groupInfo.groupColor,
            staffNames: groupInfo.staffNames,
            teamName: groupInfo.teamName,
            teamColor: groupInfo.teamColor,
            teamLeaders: groupInfo.teamLeaders,
          });
        }
      } else {
        setSelectedTablePopup(null);
      }

      // Kamera kilidi kapalıysa hareket ettir
      if (!lockCamera && viewMode === "2d" && canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth;
        const containerHeight = canvasContainerRef.current.clientHeight;
        const targetX = -(table.x * zoom - containerWidth / 2);
        const targetY = -(table.y * zoom - containerHeight / 2);
        setPanOffset({ x: targetX, y: targetY });
      }
      setTimeout(() => setHighlightedTableId(null), 8000);
    },
    [viewMode, zoom, lockCamera, showGroupView, tableToGroupMap],
  );

  const handleDirectSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    const exactMatch = placedTables.find(
      (t) => t.tableNumber.toString() === query || t.locaName === query,
    );
    if (exactMatch) {
      handleTableSelect(exactMatch);
    } else if (searchResults.length > 0) {
      handleTableSelect(searchResults[0]);
    }
  }, [searchQuery, placedTables, searchResults, handleTableSelect]);

  const canvasTables: CanvasTable[] = useMemo(() => {
    return placedTables.map((table) => {
      const groupInfo = tableToGroupMap[table.id];

      // Grup görünümü açıksa grup rengini kullan
      const displayColor =
        showGroupView && groupInfo
          ? groupInfo.groupColor
          : TABLE_TYPE_CONFIG[table.type]?.color || "#6b7280";

      return {
        id: table.id,
        label: table.isLoca
          ? table.locaName || `L${table.tableNumber}`
          : `${table.tableNumber}`,
        x: table.x,
        y: table.y,
        capacity: table.capacity,
        type: table.type,
        typeId: table.type,
        typeName: table.isLoca
          ? "Loca"
          : TABLE_TYPE_CONFIG[table.type]?.label || table.type,
        color: displayColor,
        rotation: 0,
        shape: table.isLoca ? "rectangle" : "round",
        floor: table.isLoca ? 2 : 1,
        // Grup bilgisi (3D için)
        staffColor:
          showGroupView && groupInfo ? groupInfo.groupColor : undefined,
      };
    });
  }, [placedTables, showGroupView, tableToGroupMap]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleZoomReset = () => {
    setZoom(1.2);
    setPanOffset({ x: 0, y: 0 });
  };

  // Canvas drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== "2d") return;

    // Konum belirleme modundaysa, tıklanan yeri kaydet
    if (isSettingPosition) {
      const canvasRect = (e.currentTarget as HTMLElement)
        .querySelector(".relative")
        ?.getBoundingClientRect();
      if (canvasRect) {
        const x = (e.clientX - canvasRect.left) / zoom;
        const y = (e.clientY - canvasRect.top) / zoom;
        const newPosition = { x, y };
        setMyPosition(newPosition);
        localStorage.setItem(
          `myPosition_${eventId}`,
          JSON.stringify(newPosition),
        );
        setIsSettingPosition(false);
        return;
      }
    }

    // Popup açıksa ve boş alana tıklandıysa kapat
    if (selectedTablePopup) {
      setSelectedTablePopup(null);
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || viewMode !== "2d") return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

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
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Back + Event Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/check-in")}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white truncate max-w-[150px]">
                  {event?.name}
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {event?.eventDate && formatDate(event.eventDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Search + Controls */}
          <div className="flex items-center gap-2 flex-1 justify-center max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Masa ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDirectSearch();
                }}
                className="pl-9 pr-8 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm h-10 rounded-lg focus:ring-2 focus:ring-cyan-500 w-full"
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
                  {searchResults.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{
                          backgroundColor:
                            TABLE_TYPE_CONFIG[table.type]?.color || "#6b7280",
                        }}
                      >
                        {table.isLoca ? table.locaName : table.tableNumber}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-white text-sm font-medium">
                          {table.isLoca
                            ? `Loca ${table.locaName}`
                            : `Masa ${table.tableNumber}`}
                        </p>
                      </div>
                      <MapPin className="w-3 h-3 text-cyan-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-600">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === "2d"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === "3d"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                3D
              </button>
            </div>

            {/* Zoom Controls - Only in 2D */}
            {viewMode === "2d" && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-600">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Uzaklaştır"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-cyan-400 font-mono w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Yakınlaştır"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors border-l border-slate-600"
                  title="Sıfırla"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* My Position Button - Both 2D and 3D */}
            <button
              onClick={() => {
                if (viewMode === "3d") {
                  // 3D modda 2D'ye geç ve konum belirleme modunu aç
                  setViewMode("2d");
                  setIsSettingPosition(true);
                } else {
                  setIsSettingPosition(!isSettingPosition);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isSettingPosition
                  ? "bg-green-600 text-white border-green-500 animate-pulse"
                  : myPosition
                    ? "bg-green-600/20 text-green-400 border-green-500/50 hover:bg-green-600/30"
                    : "bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:bg-slate-700"
              }`}
              title={
                isSettingPosition
                  ? "Konumu belirlemek için haritaya tıkla"
                  : myPosition
                    ? "Konumum işaretli"
                    : "Konumumu İşaretle"
              }
            >
              {isSettingPosition ? (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  Tıkla
                </>
              ) : myPosition ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Yerim
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5" />
                  Yerim
                </>
              )}
            </button>

            {/* Grup Görünümü Butonu */}
            <button
              onClick={() => setShowGroupView(!showGroupView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                showGroupView
                  ? "bg-purple-600 text-white border-purple-500"
                  : "bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:bg-slate-700"
              }`}
              title="Grupları ve görevlileri göster"
            >
              <Users className="w-3.5 h-3.5" />
              Gruplar
            </button>
          </div>

          {/* Right: Stats */}
          <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-center px-2">
              <p className="text-lg font-bold text-white">{stats.tables}</p>
              <p className="text-[9px] text-slate-400">Masa</p>
            </div>
            <div className="w-px h-5 bg-slate-700" />
            <div className="text-center px-2">
              <p className="text-lg font-bold text-pink-400">{stats.locas}</p>
              <p className="text-[9px] text-slate-400">Loca</p>
            </div>
            <div className="w-px h-5 bg-slate-700" />
            <div className="text-center px-2">
              <p className="text-lg font-bold text-cyan-400">
                {stats.totalCapacity}
              </p>
              <p className="text-[9px] text-slate-400">Kapasite</p>
            </div>
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
              cursor: isSettingPosition
                ? "crosshair"
                : isDragging
                  ? "grabbing"
                  : "grab",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
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
                  const groupInfo = tableToGroupMap[table.id];
                  const config =
                    TABLE_TYPE_CONFIG[table.type] ||
                    TABLE_TYPE_CONFIG.unassigned;
                  const size = 32 * zoom;

                  // Grup görünümü açıksa grup rengini kullan
                  const displayColor =
                    showGroupView && groupInfo
                      ? groupInfo.groupColor
                      : config.color;
                  const displayBorder =
                    showGroupView && groupInfo
                      ? groupInfo.groupColor
                      : config.borderColor;

                  return (
                    <div
                      key={table.id}
                      className={`absolute flex flex-col items-center justify-center rounded-full text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${
                        isHighlighted ? "z-30" : "z-10"
                      }`}
                      style={{
                        left: table.x * zoom,
                        top: table.y * zoom,
                        width: size,
                        height: size,
                        backgroundColor: displayColor,
                        border: `2px solid ${displayBorder}`,
                        fontSize: Math.max(8, 11 * zoom),
                        boxShadow: isHighlighted
                          ? `0 0 0 4px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.6)`
                          : `0 4px 12px ${displayColor}40`,
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
                  const groupInfo = tableToGroupMap[loca.id];
                  const width = 48 * zoom;
                  const height = 24 * zoom;

                  // Grup görünümü açıksa grup rengini kullan
                  const displayColor =
                    showGroupView && groupInfo
                      ? groupInfo.groupColor
                      : TABLE_TYPE_CONFIG.loca.color;
                  const displayBorder =
                    showGroupView && groupInfo
                      ? groupInfo.groupColor
                      : TABLE_TYPE_CONFIG.loca.borderColor;

                  return (
                    <div
                      key={loca.id}
                      className={`absolute flex flex-col items-center justify-center rounded-lg text-white font-bold transition-all duration-500 cursor-pointer hover:scale-110 ${
                        isHighlighted ? "z-30" : "z-10"
                      }`}
                      style={{
                        left: loca.x * zoom,
                        top: loca.y * zoom,
                        width,
                        height,
                        backgroundColor: displayColor,
                        border: `2px solid ${displayBorder}`,
                        fontSize: Math.max(7, 9 * zoom),
                        boxShadow: isHighlighted
                          ? `0 0 0 4px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.6)`
                          : `0 4px 12px ${displayColor}40`,
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
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-start gap-3"
                  style={{ transform: `translateX(-50%) scale(${1 / zoom})` }}
                >
                  {/* Masa Kartı */}
                  <div className="bg-cyan-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-3">
                    <MapPin className="w-6 h-6" />
                    <span className="font-bold text-lg">
                      {(() => {
                        const table = placedTables.find(
                          (t) => t.id === highlightedTableId,
                        );
                        if (!table) return "";
                        return table.isLoca
                          ? `Loca ${table.locaName}`
                          : `Masa ${table.tableNumber}`;
                      })()}
                    </span>
                    <span className="text-cyan-200">← Burada</span>
                  </div>

                  {/* Takım Bilgi Kartı - Grup görünümü açıksa göster */}
                  {showGroupView &&
                    (() => {
                      const groupInfo = tableToGroupMap[highlightedTableId];
                      if (!groupInfo) return null;

                      return (
                        <div
                          className="bg-slate-900/95 border-2 rounded-xl p-4 shadow-2xl backdrop-blur-sm min-w-[220px] animate-fadeIn"
                          style={{
                            borderColor:
                              groupInfo.teamColor || groupInfo.groupColor,
                          }}
                        >
                          {/* Grup Bilgisi */}
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: groupInfo.groupColor }}
                            />
                            <span className="text-white font-bold text-sm">
                              {groupInfo.groupName}
                            </span>
                          </div>

                          {/* Takım Bilgisi */}
                          {groupInfo.teamName && (
                            <div className="mb-3">
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                                Takım
                              </p>
                              <div
                                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{
                                  backgroundColor: `${groupInfo.teamColor}20`,
                                }}
                              >
                                <Users
                                  className="w-4 h-4"
                                  style={{ color: groupInfo.teamColor }}
                                />
                                <span className="text-white font-medium text-sm">
                                  {groupInfo.teamName}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Takım Kaptanları */}
                          {groupInfo.teamLeaders &&
                            groupInfo.teamLeaders.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                                  Takım Kaptanı
                                </p>
                                <div className="space-y-1">
                                  {groupInfo.teamLeaders.map((leader, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 bg-amber-500/20 px-3 py-2 rounded-lg"
                                    >
                                      <Crown className="w-4 h-4 text-amber-400" />
                                      <span className="text-amber-200 font-medium text-sm">
                                        {leader.staffName}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Görevliler */}
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                              Görevliler
                            </p>
                            {groupInfo.staffNames.length > 0 ? (
                              <div className="space-y-1 max-h-24 overflow-y-auto">
                                {groupInfo.staffNames.map((name, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg"
                                  >
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span className="text-white text-xs">
                                      {name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">
                                Görevli atanmamış
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* Staff Info Popup - Masaya tıklayınca gösterilir */}
              {selectedTablePopup && showGroupView && (
                <div
                  className="absolute z-50"
                  style={{
                    left: selectedTablePopup.x * zoom,
                    top: selectedTablePopup.y * zoom - 80,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="bg-slate-900/95 border-2 rounded-xl p-3 shadow-2xl backdrop-blur-sm min-w-[180px] max-w-[280px]"
                    style={{ borderColor: selectedTablePopup.groupColor }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-700">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: selectedTablePopup.groupColor,
                          }}
                        />
                        <span className="text-white font-bold text-sm">
                          {selectedTablePopup.tableLabel}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTablePopup(null);
                        }}
                        className="p-1 hover:bg-slate-700 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>

                    {/* Grup Adı */}
                    <div
                      className="text-xs font-medium mb-2 px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: `${selectedTablePopup.groupColor}20`,
                        color: selectedTablePopup.groupColor,
                      }}
                    >
                      {selectedTablePopup.groupName}
                    </div>

                    {/* Görevliler */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        Görevliler
                      </p>
                      {selectedTablePopup.staffNames.length > 0 ? (
                        <div className="space-y-1">
                          {selectedTablePopup.staffNames.map((name, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs text-white bg-slate-800 px-2 py-1.5 rounded-lg"
                            >
                              <User className="w-3 h-3 text-slate-400" />
                              {name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Görevli atanmamış
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent"
                      style={{
                        borderTopColor: selectedTablePopup.groupColor,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* My Position Marker */}
              {myPosition && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    left: myPosition.x * zoom - 16,
                    top: myPosition.y * zoom - 40,
                  }}
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-green-500" />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                      BEN
                    </div>
                  </div>
                </div>
              )}

              {/* Position Setting Mode Indicator */}
              {isSettingPosition && (
                <div className="absolute inset-0 bg-green-500/10 border-4 border-dashed border-green-500/50 rounded-2xl flex items-center justify-center pointer-events-none z-40">
                  <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
                    <Crosshair className="w-6 h-6 animate-pulse" />
                    <span className="font-bold">
                      Konumunuzu belirlemek için haritaya tıklayın
                    </span>
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
              tableGroups={
                showGroupView
                  ? tableGroups.map((g, index) => ({
                      id: g.id,
                      name: g.name,
                      color:
                        g.color || GROUP_COLORS[index % GROUP_COLORS.length],
                      tableIds: g.tableIds,
                      staffAssignments: staffAssignments
                        .filter((a) =>
                          a.tableIds.some((tid) => g.tableIds.includes(tid)),
                        )
                        .map((a) => ({
                          id: a.id,
                          staffId: a.staffId,
                          staffName: a.staffName,
                          role: "staff",
                        })),
                    }))
                  : []
              }
              viewMode={showGroupView ? "step2" : "default"}
              selectedTableIds={highlightedTableId ? [highlightedTableId] : []}
              onTableClick={(tableId) => {
                setHighlightedTableId(tableId);
                setTimeout(() => setHighlightedTableId(null), 8000);
              }}
              entrancePosition={
                myPosition || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 }
              }
              showPath={!!highlightedTableId}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 bg-slate-800/95 border border-slate-700 rounded-xl p-3 z-40 backdrop-blur-sm">
        {showGroupView ? (
          <>
            <p className="text-xs text-slate-400 mb-2 font-medium">
              GRUPLAR & GÖREVLİLER
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tableGroups.map((group, index) => {
                const groupColor =
                  group.color || GROUP_COLORS[index % GROUP_COLORS.length];
                const staffForGroup = staffAssignments
                  .filter((a) =>
                    a.tableIds.some((tid) => group.tableIds.includes(tid)),
                  )
                  .map((a) => a.staffName);
                const uniqueStaff = [...new Set(staffForGroup)];

                return (
                  <div key={group.id} className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                      style={{ backgroundColor: groupColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-white font-medium">
                        {group.name}
                      </span>
                      {uniqueStaff.length > 0 && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {uniqueStaff.slice(0, 3).join(", ")}
                          {uniqueStaff.length > 3 &&
                            ` +${uniqueStaff.length - 3}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {tableGroups.length === 0 && (
                <p className="text-xs text-slate-500">Grup tanımlanmamış</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-2 font-medium">
              MASA TİPLERİ
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(TABLE_TYPE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs text-slate-300">{config.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            box-shadow:
              0 0 0 4px rgba(34, 211, 238, 0.8),
              0 0 30px rgba(34, 211, 238, 0.6);
          }
          50% {
            box-shadow:
              0 0 0 8px rgba(34, 211, 238, 0.4),
              0 0 50px rgba(34, 211, 238, 0.8);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
