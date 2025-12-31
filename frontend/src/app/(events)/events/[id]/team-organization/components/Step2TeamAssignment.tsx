"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  Link,
  Unlink,
  Crown,
  UserPlus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  TableData,
  TableGroup,
  TeamDefinition,
  DEFAULT_COLORS,
  StageElement,
  ServicePoint,
  Staff,
  STAFF_ROLES,
  StaffRole,
} from "../types";
import {
  useCanvasInteraction,
  CanvasTool,
} from "../hooks/useCanvasInteraction";
import { CanvasRenderer } from "./CanvasRenderer";
import { cn } from "@/lib/utils";

// Takım Lideri/Kaptan tipi
interface TeamLeader {
  staffId: string;
  staffName: string;
  role: StaffRole;
}

interface Step2TeamAssignmentProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  stageElements?: StageElement[];
  servicePoints?: ServicePoint[];
  allStaff?: Staff[];
  viewMode?: "2d" | "3d";
  onAddTeam: (
    name: string,
    color?: string,
    leaders?: TeamLeader[]
  ) => TeamDefinition;
  onUpdateTeam?: (
    teamId: string,
    updates: Partial<TeamDefinition> & { leaders?: TeamLeader[] }
  ) => void;
  onDeleteTeam?: (teamId: string) => void;
  onAssignGroupToTeam: (groupId: string, teamId: string) => void;
  onUnassignGroupFromTeam: (groupId: string) => void;
  onCanvasStateChange?: (state: {
    zoom: number;
    activeTool: CanvasTool;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;
    onToolChange: (tool: CanvasTool) => void;
    onSelectAll: () => void;
  }) => void;
}

export function Step2TeamAssignment({
  tables,
  tableGroups,
  teams,
  stageElements = [],
  servicePoints = [],
  allStaff = [],
  viewMode = "2d",
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAssignGroupToTeam,
  onUnassignGroupFromTeam,
  onCanvasStateChange,
}: Step2TeamAssignmentProps) {
  // Canvas interaction hook
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    zoom,
    offset,
    selectedTableIds,
    activeTool,
    isLassoSelecting,
    lassoStart,
    lassoEnd,
    setSelectedTableIds,
    setActiveTool,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleSelectAll,
    handleClearSelection,
  } = useCanvasInteraction({
    tables,
    onSelectionChange: () => {},
  });

  // Local state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(DEFAULT_COLORS[0]);
  const [editingTeam, setEditingTeam] = useState<TeamDefinition | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Kaptan/Lider seçimi state
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState("");

  // Stable refs for callbacks
  const handlersRef = useRef({
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    onToolChange: setActiveTool,
    onSelectAll: handleSelectAll,
  });

  handlersRef.current = {
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    onToolChange: setActiveTool,
    onSelectAll: handleSelectAll,
  };

  // Expose canvas state to parent
  const onCanvasStateChangeRef = useRef(onCanvasStateChange);
  onCanvasStateChangeRef.current = onCanvasStateChange;

  useEffect(() => {
    if (onCanvasStateChangeRef.current) {
      onCanvasStateChangeRef.current({
        zoom,
        activeTool,
        onZoomIn: () => handlersRef.current.onZoomIn(),
        onZoomOut: () => handlersRef.current.onZoomOut(),
        onResetView: () => handlersRef.current.onResetView(),
        onToolChange: (tool: CanvasTool) =>
          handlersRef.current.onToolChange(tool),
        onSelectAll: () => handlersRef.current.onSelectAll(),
      });
    }
  }, [zoom, activeTool]);

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

  // Get table group helper
  const getTableGroup = useCallback(
    (tableId: string) => tableToGroupMap.get(tableId),
    [tableToGroupMap]
  );

  // Unassigned groups (not assigned to any team)
  const unassignedGroups = useMemo(() => {
    return tableGroups.filter((g) => !g.assignedTeamId);
  }, [tableGroups]);

  // Groups by team
  const groupsByTeam = useMemo(() => {
    const map = new Map<string, TableGroup[]>();
    teams.forEach((team) => {
      map.set(
        team.id,
        tableGroups.filter((g) => g.assignedTeamId === team.id)
      );
    });
    return map;
  }, [teams, tableGroups]);

  // Kaptan/Süpervizör olabilecek personeller (pozisyona göre filtrele)
  const leaderCandidates = useMemo(() => {
    return allStaff.filter((s) => {
      const pos = s.position?.toLowerCase() || "";
      return (
        pos.includes("kaptan") ||
        pos.includes("captain") ||
        pos.includes("şef") ||
        pos.includes("süpervizör") ||
        pos.includes("supervisor") ||
        pos.includes("sef")
      );
    });
  }, [allStaff]);

  // Arama ile filtrelenmiş personeller
  const filteredLeaderCandidates = useMemo(() => {
    if (!leaderSearchQuery.trim()) return leaderCandidates;
    const query = leaderSearchQuery.toLowerCase();
    return leaderCandidates.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        s.position?.toLowerCase().includes(query)
    );
  }, [leaderCandidates, leaderSearchQuery]);

  // Kaptan ekle
  const handleAddLeader = useCallback(
    (staff: Staff) => {
      if (teamLeaders.some((l) => l.staffId === staff.id)) return;

      // Pozisyona göre rol belirle
      const pos = staff.position?.toLowerCase() || "";
      let role: StaffRole = "captain";
      if (pos.includes("süpervizör") || pos.includes("supervisor")) {
        role = "supervisor";
      }

      setTeamLeaders((prev) => [
        ...prev,
        { staffId: staff.id, staffName: staff.fullName, role },
      ]);
    },
    [teamLeaders]
  );

  // Kaptan kaldır
  const handleRemoveLeader = useCallback((staffId: string) => {
    setTeamLeaders((prev) => prev.filter((l) => l.staffId !== staffId));
  }, []);

  // Helper: Convert table labels to UUIDs
  const getTableIdsByLabels = useCallback(
    (labels: string[]): string[] => {
      return labels
        .map((label) => labelToIdMap.get(label))
        .filter((id): id is string => id !== undefined);
    },
    [labelToIdMap]
  );

  // Handle table click - select group
  const handleTableClickWithGroup = useCallback(
    (tableId: string, e: React.MouseEvent) => {
      const group = getTableGroup(tableId);
      if (group) {
        // group.tableIds masa numaralarını içeriyor, UUID'lere çevir
        const groupTableUUIDs = getTableIdsByLabels(group.tableIds);

        if (e.ctrlKey || e.metaKey) {
          setSelectedGroupIds((prev) =>
            prev.includes(group.id)
              ? prev.filter((id) => id !== group.id)
              : [...prev, group.id]
          );
          setSelectedTableIds((prev) => {
            if (prev.some((id) => groupTableUUIDs.includes(id))) {
              return prev.filter((id) => !groupTableUUIDs.includes(id));
            }
            return [...new Set([...prev, ...groupTableUUIDs])];
          });
        } else {
          setSelectedGroupIds([group.id]);
          setSelectedTableIds(groupTableUUIDs);
        }
      }
    },
    [getTableGroup, setSelectedTableIds, getTableIdsByLabels]
  );

  // Open team modal for create
  const handleOpenTeamModal = useCallback(() => {
    setEditingTeam(null);
    setNewTeamName(`Takım ${teams.length + 1}`);
    setNewTeamColor(DEFAULT_COLORS[teams.length % DEFAULT_COLORS.length]);
    setTeamLeaders([]);
    setLeaderSearchQuery("");
    setShowTeamModal(true);
  }, [teams.length]);

  // Open team modal for edit
  const handleEditTeam = useCallback(
    (team: TeamDefinition & { leaders?: TeamLeader[] }) => {
      setEditingTeam(team);
      setNewTeamName(team.name);
      setNewTeamColor(team.color);
      setTeamLeaders(team.leaders || []);
      setLeaderSearchQuery("");
      setShowTeamModal(true);
    },
    []
  );

  // Save team
  const handleSaveTeam = useCallback(() => {
    if (!newTeamName.trim()) return;

    if (editingTeam && onUpdateTeam) {
      onUpdateTeam(editingTeam.id, {
        name: newTeamName.trim(),
        color: newTeamColor,
        leaders: teamLeaders,
      });
    } else {
      const newTeam = onAddTeam(newTeamName.trim(), newTeamColor, teamLeaders);
      // Seçili grupları yeni takıma ata
      if (selectedGroupIds.length > 0) {
        selectedGroupIds.forEach((groupId) => {
          onAssignGroupToTeam(groupId, newTeam.id);
        });
        setSelectedGroupIds([]);
        handleClearSelection();
      }
    }

    setShowTeamModal(false);
    setEditingTeam(null);
    setTeamLeaders([]);
  }, [
    newTeamName,
    newTeamColor,
    teamLeaders,
    editingTeam,
    onAddTeam,
    onUpdateTeam,
    selectedGroupIds,
    onAssignGroupToTeam,
    handleClearSelection,
  ]);

  // Assign selected groups to team
  const handleAssignToTeam = useCallback(
    (teamId: string) => {
      selectedGroupIds.forEach((groupId) => {
        onAssignGroupToTeam(groupId, teamId);
      });
      setSelectedGroupIds([]);
      handleClearSelection();
    },
    [selectedGroupIds, onAssignGroupToTeam, handleClearSelection]
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClearSelection();
        setSelectedGroupIds([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      }
    },
    [handleClearSelection, handleSelectAll]
  );

  return (
    <TooltipProvider>
      <div
        className="flex gap-4 h-[660px]"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Left Panel - Teams & Groups */}
        <div className="w-80 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col flex-shrink-0 h-full">
          {/* Header */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Takımlar
              </h3>
              <Button
                size="sm"
                onClick={handleOpenTeamModal}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                Yeni Takım
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Grupları sürükleyerek veya seçerek takımlara atayın
            </p>
          </div>

          {/* Teams List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
            {/* Unassigned Groups */}
            {unassignedGroups.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2 py-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">
                    Atanmamış Gruplar ({unassignedGroups.length})
                  </span>
                </div>
                <div className="space-y-1 pl-2">
                  {unassignedGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => {
                        setSelectedGroupIds([group.id]);
                        setSelectedTableIds(
                          getTableIdsByLabels(group.tableIds)
                        );
                      }}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all",
                        "border border-dashed",
                        selectedGroupIds.includes(group.id)
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-slate-600 hover:border-slate-500 bg-slate-700/30"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm text-white truncate flex-1">
                        {group.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.tableIds.length} masa
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teams */}
            {teams.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Henüz takım yok</p>
                <p className="text-xs mt-1">
                  Yeni takım oluşturun ve grupları atayın
                </p>
              </div>
            ) : (
              teams.map((team) => {
                const teamGroups = groupsByTeam.get(team.id) || [];
                const totalTables = teamGroups.reduce(
                  (sum, g) => sum + g.tableIds.length,
                  0
                );
                const totalStaff = teamGroups.reduce(
                  (sum, g) => sum + (g.staffAssignments?.length || 0),
                  0
                );

                return (
                  <div
                    key={team.id}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: `${team.color}50` }}
                  >
                    {/* Team Header */}
                    <div
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:opacity-90"
                      style={{ backgroundColor: `${team.color}20` }}
                      onClick={() =>
                        handleEditTeam(
                          team as TeamDefinition & { leaders?: TeamLeader[] }
                        )
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: team.color }}
                        >
                          {team.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-[10px]"
                          style={{
                            backgroundColor: `${team.color}30`,
                            color: team.color,
                          }}
                        >
                          {teamGroups.length} grup • {totalTables} masa •{" "}
                          {totalStaff} personel
                        </Badge>
                        {onDeleteTeam && teamGroups.length === 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTeam(team.id);
                            }}
                            className="h-5 w-5 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Team Leaders */}
                    {(team as any).leaders &&
                      (team as any).leaders.length > 0 && (
                        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-slate-700/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Crown className="w-3 h-3 text-amber-400" />
                            {(team as any).leaders.map((leader: TeamLeader) => (
                              <Badge
                                key={leader.staffId}
                                className="text-[10px] bg-amber-500/20 text-amber-300"
                              >
                                {leader.staffName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Team Groups */}
                    <div className="p-2 space-y-1 bg-slate-800/30">
                      {teamGroups.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-2">
                          Grup atanmamış
                        </p>
                      ) : (
                        teamGroups.map((group) => (
                          <div
                            key={group.id}
                            onClick={() => {
                              setSelectedGroupIds([group.id]);
                              setSelectedTableIds(
                                getTableIdsByLabels(group.tableIds)
                              );
                            }}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all",
                              selectedGroupIds.includes(group.id)
                                ? "bg-slate-600/50 ring-1 ring-white/30"
                                : "hover:bg-slate-700/50"
                            )}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="text-xs text-slate-300 truncate flex-1">
                              {group.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {group.tableIds.length} masa
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnassignGroupFromTeam(group.id);
                              }}
                              className="h-4 w-4 text-slate-500 hover:text-red-400"
                              title="Takımdan çıkar"
                            >
                              <Unlink className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        ))
                      )}

                      {/* Drop zone for assigning groups */}
                      {selectedGroupIds.length > 0 &&
                        !selectedGroupIds.every((id) =>
                          teamGroups.some((g) => g.id === id)
                        ) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignToTeam(team.id)}
                            className="w-full h-7 text-xs border-dashed mt-2"
                            style={{
                              borderColor: team.color,
                              color: team.color,
                            }}
                          >
                            <Link className="w-3 h-3 mr-1" />
                            Seçili grupları bu takıma ata
                          </Button>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-700 bg-slate-800/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {teams.length} takım • {tableGroups.length} grup
              </span>
              {unassignedGroups.length > 0 && (
                <span className="text-amber-400">
                  {unassignedGroups.length} atanmamış
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right - Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Selection Action Bar */}
          <div className="h-12 flex items-center justify-center mb-2">
            {selectedGroupIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-600 shadow-lg">
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {selectedGroupIds.length} grup seçili
                </Badge>

                {/* Takıma Ata */}
                {teams.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 px-2">
                      Takıma ata:
                    </span>
                    {teams.slice(0, 4).map((team) => (
                      <Button
                        key={team.id}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        style={{ borderColor: team.color, color: team.color }}
                        onClick={() => handleAssignToTeam(team.id)}
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="text-xs truncate max-w-[60px]">
                          {team.name}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}

                {/* Yeni Takım Oluştur */}
                <Button
                  size="sm"
                  onClick={handleOpenTeamModal}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Yeni Takım
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    handleClearSelection();
                    setSelectedGroupIds([]);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                Canvas'ta gruplara tıklayarak seçin, sonra takıma atayın
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 relative">
            <CanvasRenderer
              ref={canvasRef}
              tables={tables}
              tableGroups={tableGroups}
              teams={teams}
              stageElements={stageElements}
              servicePoints={servicePoints}
              selectedTableIds={selectedTableIds}
              zoom={zoom}
              offset={offset}
              activeTool={activeTool}
              isLassoSelecting={isLassoSelecting}
              lassoStart={lassoStart}
              lassoEnd={lassoEnd}
              onTableClick={handleTableClickWithGroup}
              onCanvasMouseDown={handleCanvasMouseDown}
              onCanvasMouseMove={handleCanvasMouseMove}
              onCanvasMouseUp={handleCanvasMouseUp}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetView={handleResetView}
              onToolChange={setActiveTool}
              onSelectAll={handleSelectAll}
              showToolbar={false}
              showServicePoints={true}
              show3DToggle={false}
              viewMode={viewMode}
              className="h-full"
            />
          </div>
        </div>

        {/* Team Modal */}
        <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {editingTeam ? "Takımı Düzenle" : "Yeni Takım Oluştur"}
              </DialogTitle>
              {selectedGroupIds.length > 0 && !editingTeam && (
                <DialogDescription className="text-slate-400">
                  Seçili {selectedGroupIds.length} grup bu takıma atanacak
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Sol: Takım Adı ve Renk */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">
                      Takım Adı
                    </label>
                    <Input
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Örn: A Takımı"
                      className="bg-slate-700 border-slate-600"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">
                      Renk Seçin
                    </label>
                    <div className="grid grid-cols-8 gap-2">
                      {DEFAULT_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                            newTeamColor === color
                              ? "border-white scale-110"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewTeamColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sağ: Kaptan/Lider Seçimi */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    Takım Kaptanları / Süpervizörler
                  </label>

                  {/* Seçilen Kaptanlar */}
                  {teamLeaders.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {teamLeaders.map((leader) => {
                        const roleConfig = STAFF_ROLES.find(
                          (r) => r.value === leader.role
                        );
                        return (
                          <div
                            key={leader.staffId}
                            className="flex items-center justify-between px-2 py-1.5 bg-slate-700/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Crown
                                className="w-3 h-3"
                                style={{
                                  color: roleConfig?.color || "#f59e0b",
                                }}
                              />
                              <span className="text-sm text-white">
                                {leader.staffName}
                              </span>
                              <Badge
                                className="text-[10px]"
                                style={{
                                  backgroundColor: `${roleConfig?.color}30`,
                                  color: roleConfig?.color,
                                }}
                              >
                                {roleConfig?.label || leader.role}
                              </Badge>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveLeader(leader.staffId)}
                              className="h-5 w-5 text-red-400 hover:text-red-300"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Kaptan Arama */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Kaptan/Süpervizör ara..."
                      value={leaderSearchQuery}
                      onChange={(e) => setLeaderSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm bg-slate-700 border-slate-600"
                    />
                  </div>

                  {/* Kaptan Listesi */}
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-600 rounded-lg p-1">
                    {filteredLeaderCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">
                        {leaderSearchQuery
                          ? "Sonuç bulunamadı"
                          : "Kaptan/Süpervizör pozisyonunda personel yok"}
                      </p>
                    ) : (
                      filteredLeaderCandidates.map((staff) => {
                        const isSelected = teamLeaders.some(
                          (l) => l.staffId === staff.id
                        );
                        return (
                          <button
                            key={staff.id}
                            onClick={() => handleAddLeader(staff)}
                            disabled={isSelected}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors",
                              isSelected
                                ? "bg-slate-600/30 opacity-50 cursor-not-allowed"
                                : "hover:bg-slate-700/50 cursor-pointer"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-white">
                                {staff.fullName}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {staff.position}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowTeamModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleSaveTeam}
                disabled={!newTeamName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Check className="w-4 h-4 mr-1" />
                {editingTeam ? "Kaydet" : "Oluştur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
