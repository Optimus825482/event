"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Clock,
  Edit3,
  User,
  ChevronDown,
  ChevronUp,
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
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  TableData,
  TableGroup,
  TeamDefinition,
  TeamLeader,
  DEFAULT_COLORS,
  StageElement,
  ServicePoint,
  Staff,
  STAFF_ROLES,
  StaffRole,
  GroupStaffAssignment,
} from "../types";
import {
  useCanvasInteraction,
  CanvasTool,
} from "../hooks/useCanvasInteraction";
import { CanvasRenderer } from "./CanvasRenderer";
import { cn } from "@/lib/utils";
import { positionsApi } from "@/lib/api";

// ==================== TYPES ====================

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
    leaders?: TeamLeader[],
  ) => TeamDefinition;
  onUpdateTeam?: (
    teamId: string,
    updates: Partial<TeamDefinition> & { leaders?: TeamLeader[] },
  ) => void;
  onDeleteTeam?: (teamId: string) => void;
  onAddTableGroup: (
    name: string,
    tableIds: string[],
    color?: string,
  ) => TableGroup;
  onDeleteTableGroup?: (groupId: string) => void;
  onAssignGroupToTeam: (groupId: string, teamId: string) => void;
  onUnassignGroupFromTeam: (groupId: string) => void;
  onAssignStaffToGroup: (
    groupId: string,
    assignments: GroupStaffAssignment[],
  ) => void;
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

// ==================== COMPONENT ====================

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
  onAddTableGroup,
  onDeleteTableGroup,
  onAssignGroupToTeam,
  onUnassignGroupFromTeam,
  onAssignStaffToGroup,
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

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAssignmentKey, setEditingAssignmentKey] = useState<
    string | null
  >(null);

  // Modal form state
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>("waiter");
  const [formTableIds, setFormTableIds] = useState<string[]>([]);
  const [formShiftStart, setFormShiftStart] = useState("18:00");
  const [formShiftEnd, setFormShiftEnd] = useState("02:00");

  // Search
  const [staffSearch, setStaffSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Positions from DB
  const [positions, setPositions] = useState<{ id: string; name: string }[]>(
    [],
  );

  // Stable refs for canvas callbacks
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

  // Load positions
  useEffect(() => {
    positionsApi
      .getAll()
      .then((res) => {
        setPositions(
          (res.data || []).map((p: any) => ({ id: p.id, name: p.name })),
        );
      })
      .catch(() => {
        setPositions([
          { id: "1", name: "Garson" },
          { id: "2", name: "Kaptan" },
          { id: "3", name: "Süpervizör" },
          { id: "4", name: "Komi" },
          { id: "5", name: "Barmen" },
          { id: "6", name: "Hostes" },
        ]);
      });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==================== MAPS ====================

  const labelToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => map.set(t.label, t.id));
    return map;
  }, [tables]);

  const idToLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => map.set(t.id, t.label));
    return map;
  }, [tables]);

  const getTableLabelsByIds = useCallback(
    (ids: string[]): string[] =>
      ids.map((id) => idToLabelMap.get(id)).filter((l): l is string => !!l),
    [idToLabelMap],
  );

  const getTableIdsByLabels = useCallback(
    (labels: string[]): string[] =>
      labels.map((l) => labelToIdMap.get(l)).filter((id): id is string => !!id),
    [labelToIdMap],
  );

  // ==================== DERIVED DATA ====================

  // Flatten all staff assignments across all groups for display
  const allAssignments = useMemo(() => {
    const result: Array<{
      groupId: string;
      assignment: GroupStaffAssignment;
      tableLabels: string[];
      teamId?: string;
    }> = [];
    tableGroups.forEach((g) => {
      (g.staffAssignments || []).forEach((a) => {
        result.push({
          groupId: g.id,
          assignment: a,
          tableLabels: g.tableIds,
          teamId: g.assignedTeamId,
        });
      });
    });
    return result;
  }, [tableGroups]);

  // Filtered staff for search
  const filteredStaff = useMemo(() => {
    const active = allStaff.filter((s) => s.isActive);
    if (!staffSearch.trim()) return active;
    const q = staffSearch.toLowerCase();
    return active.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q),
    );
  }, [allStaff, staffSearch]);

  // Filtered tables for search
  const filteredTables = useMemo(() => {
    // Numerik sıralama helper
    const numSort = (a: TableData, b: TableData) => {
      const numA = parseInt(a.label.replace(/\D/g, ""), 10);
      const numB = parseInt(b.label.replace(/\D/g, ""), 10);
      const isLocaA = a.label.startsWith("L");
      const isLocaB = b.label.startsWith("L");
      if (isLocaA !== isLocaB) return isLocaA ? -1 : 1;
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.label.localeCompare(b.label);
    };

    if (!tableSearch.trim()) return [...tables].sort(numSort);

    const q = tableSearch.trim();
    const searchNum = parseInt(q, 10);

    // Eğer sayısal bir arama ise: o sayıdan başlayıp devam eden masaları göster (localar hariç)
    if (!isNaN(searchNum)) {
      return [...tables]
        .filter((t) => {
          // Loca ise hariç tut (localar "L" ile başlar)
          if (t.isLoca || t.label.startsWith("L")) return false;
          const tableNum = parseInt(t.label, 10);
          return !isNaN(tableNum) && tableNum >= searchNum;
        })
        .sort(numSort);
    }

    // Sayısal değilse metin araması yap
    const ql = q.toLowerCase();
    return tables
      .filter(
        (t) =>
          t.label.toLowerCase().includes(ql) ||
          t.typeName?.toLowerCase().includes(ql) ||
          t.locaName?.toLowerCase().includes(ql),
      )
      .sort(numSort);
  }, [tables, tableSearch]);

  // Map position to role
  const mapPositionToRole = useCallback((posName: string): StaffRole => {
    const l = posName.toLowerCase();
    if (l.includes("süpervizör") || l.includes("supervisor"))
      return "supervisor";
    if (l.includes("kaptan") || l.includes("captain")) return "captain";
    if (l.includes("komi") || l.includes("runner")) return "runner";
    if (l.includes("hostes") || l.includes("hostess")) return "hostess";
    if (l.includes("barmen") || l.includes("barman")) return "barman";
    return "waiter";
  }, []);

  // ==================== MODAL HANDLERS ====================

  const resetForm = useCallback(() => {
    setSelectedStaff(null);
    setSelectedRole("waiter");
    setFormTableIds([]);
    setFormShiftStart("18:00");
    setFormShiftEnd("02:00");
    setStaffSearch("");
    setTableSearch("");
    setShowStaffDropdown(false);
    setEditingAssignmentKey(null);
  }, []);

  // Open modal for new assignment
  const handleOpenNew = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  // Open modal for editing existing assignment
  const handleOpenEdit = useCallback(
    (
      groupId: string,
      assignment: GroupStaffAssignment,
      tableLabels: string[],
    ) => {
      const staff = allStaff.find((s) => s.id === assignment.staffId);
      setSelectedStaff(staff || null);
      setStaffSearch(staff?.fullName || assignment.staffName || "");
      setSelectedRole(assignment.role);
      setFormTableIds(getTableIdsByLabels(tableLabels));
      setFormShiftStart(assignment.shiftStart || "18:00");
      setFormShiftEnd(assignment.shiftEnd || "02:00");
      setEditingAssignmentKey(`${groupId}::${assignment.id}`);
      setShowStaffDropdown(false);
      setTableSearch("");
      setShowModal(true);
    },
    [allStaff, getTableIdsByLabels],
  );

  // Select staff
  const handleSelectStaff = useCallback(
    (staff: Staff) => {
      setSelectedStaff(staff);
      setStaffSearch(staff.fullName);
      setShowStaffDropdown(false);
      if (staff.position) {
        setSelectedRole(mapPositionToRole(staff.position));
      }
    },
    [mapPositionToRole],
  );

  // Toggle table
  const handleToggleTable = useCallback((tableId: string) => {
    setFormTableIds((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId],
    );
  }, []);

  // Select all tables
  const handleSelectAllTables = useCallback(() => {
    if (formTableIds.length === filteredTables.length) {
      setFormTableIds([]);
    } else {
      setFormTableIds(filteredTables.map((t) => t.id));
    }
  }, [formTableIds.length, filteredTables]);

  // ==================== SAVE ====================

  const handleSave = useCallback(() => {
    if (!selectedStaff || formTableIds.length === 0) return;

    const tableLabels = getTableLabelsByIds(formTableIds);
    const color = DEFAULT_COLORS[tableGroups.length % DEFAULT_COLORS.length];

    if (editingAssignmentKey) {
      // EDIT: Delete old group + old team, then create new
      const [oldGroupId] = editingAssignmentKey.split("::");
      const oldGroup = tableGroups.find((g) => g.id === oldGroupId);
      if (oldGroup?.assignedTeamId && onDeleteTeam) {
        onDeleteTeam(oldGroup.assignedTeamId);
      }
      if (onDeleteTableGroup) onDeleteTableGroup(oldGroupId);
    }

    // 1. Create group with selected tables
    const newGroup = onAddTableGroup(
      `${selectedStaff.fullName} Masaları`,
      tableLabels,
      color,
    );

    // 2. Create a hidden team (for data model compatibility)
    const newTeam = onAddTeam(selectedStaff.fullName, color);

    // 3. Assign group to team
    onAssignGroupToTeam(newGroup.id, newTeam.id);

    // 4. Assign staff to group
    const assignment: GroupStaffAssignment = {
      id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.fullName,
      role: selectedRole,
      shiftStart: formShiftStart,
      shiftEnd: formShiftEnd,
    };
    onAssignStaffToGroup(newGroup.id, [assignment]);

    // Reset form but keep modal open for next person
    resetForm();
  }, [
    selectedStaff,
    formTableIds,
    selectedRole,
    formShiftStart,
    formShiftEnd,
    editingAssignmentKey,
    tableGroups,
    getTableLabelsByIds,
    onAddTableGroup,
    onAddTeam,
    onAssignGroupToTeam,
    onAssignStaffToGroup,
    onDeleteTableGroup,
    onDeleteTeam,
    resetForm,
  ]);

  // Delete assignment
  const handleDelete = useCallback(
    (groupId: string) => {
      // Find the team that owns this group
      const group = tableGroups.find((g) => g.id === groupId);
      if (group?.assignedTeamId && onDeleteTeam) {
        onDeleteTeam(group.assignedTeamId);
      }
      if (onDeleteTableGroup) onDeleteTableGroup(groupId);
    },
    [tableGroups, onDeleteTeam, onDeleteTableGroup],
  );

  const canSave = selectedStaff && formTableIds.length > 0;

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") handleClearSelection();
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      }
    },
    [handleClearSelection, handleSelectAll],
  );

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div
        className="flex gap-4 h-[660px]"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Left Panel - Assigned Staff List */}
        <div className="w-80 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col flex-shrink-0 h-full">
          {/* Header */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Personel Atamaları
              </h3>
              <Button
                size="sm"
                onClick={handleOpenNew}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                Personel Ata
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Her personel için görev, masa ve vardiya belirleyin
            </p>
          </div>

          {/* Assignments List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {allAssignments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Henüz atama yok</p>
                <p className="text-xs mt-1 text-slate-600">
                  "Personel Ata" butonuna tıklayarak başlayın
                </p>
              </div>
            ) : (
              allAssignments.map(({ groupId, assignment, tableLabels }) => {
                const roleConfig = STAFF_ROLES.find(
                  (r) => r.value === assignment.role,
                );
                const staffInfo = allStaff.find(
                  (s) => s.id === assignment.staffId,
                );

                return (
                  <div
                    key={assignment.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      {/* Avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{
                          backgroundColor: staffInfo?.color || "#6366f1",
                        }}
                      >
                        {(assignment.staffName || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">
                          {assignment.staffName || staffInfo?.fullName}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <Badge
                            className="text-[9px] px-1 py-0"
                            style={{
                              backgroundColor: `${roleConfig?.color || "#6366f1"}25`,
                              color: roleConfig?.color || "#6366f1",
                            }}
                          >
                            {roleConfig?.label || assignment.role}
                          </Badge>
                          <span>{tableLabels.length} masa</span>
                          <span>
                            {assignment.shiftStart}-{assignment.shiftEnd}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            handleOpenEdit(groupId, assignment, tableLabels)
                          }
                          className="h-6 w-6 text-slate-400 hover:text-white"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(groupId)}
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Table chips */}
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {tableLabels.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-700 bg-slate-800/30">
            <div className="text-xs text-slate-400">
              {allAssignments.length} personel atanmış •{" "}
              {new Set(allAssignments.flatMap((a) => a.tableLabels)).size} masa
              kapsanıyor
            </div>
          </div>
        </div>

        {/* Right - Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="h-10 flex items-center justify-center mb-2">
            <div className="text-sm text-slate-500">
              Personel atayın, görev ve masalarını belirleyin
            </div>
          </div>
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
              onTableClick={(tableId) => {
                setSelectedTableIds((prev) =>
                  prev.includes(tableId)
                    ? prev.filter((id) => id !== tableId)
                    : [...prev, tableId],
                );
              }}
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

        {/* ==================== MODAL ==================== */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                {editingAssignmentKey ? "Atamayı Düzenle" : "Personel Ata"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* 1. Personel Seçimi */}
              <div ref={searchRef} className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Personel
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value);
                      setShowStaffDropdown(true);
                      if (
                        selectedStaff &&
                        e.target.value !== selectedStaff.fullName
                      ) {
                        setSelectedStaff(null);
                      }
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                    placeholder="İsim, pozisyon veya departman ile ara..."
                    className="pl-9 bg-slate-900 border-slate-600 text-white"
                    autoFocus
                  />
                </div>

                {/* Staff Dropdown */}
                {showStaffDropdown && !selectedStaff && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg max-h-48 overflow-y-auto shadow-xl">
                    {filteredStaff.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">
                        Sonuç bulunamadı
                      </div>
                    ) : (
                      filteredStaff.slice(0, 20).map((staff) => (
                        <button
                          key={staff.id}
                          onClick={() => handleSelectStaff(staff)}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-800 transition-colors text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{
                              backgroundColor: staff.color || "#6366f1",
                            }}
                          >
                            {staff.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">
                              {staff.fullName}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {staff.position || "Pozisyon belirtilmemiş"}
                              {staff.department ? ` • ${staff.department}` : ""}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 2. Görev Seçimi */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Görev
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as StaffRole)}
                  className="w-full rounded-md bg-slate-900 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Masa Seçimi */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">
                    Görevli Olduğu Masalar ({formTableIds.length} seçili)
                  </label>
                  <button
                    onClick={handleSelectAllTables}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {formTableIds.length === filteredTables.length
                      ? "Tümünü Kaldır"
                      : "Tümünü Seç"}
                  </button>
                </div>
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Masa ara..."
                  className="mb-2 bg-slate-900 border-slate-600 text-white text-sm"
                />
                <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-900 border border-slate-600 rounded-lg">
                  {filteredTables.map((table) => {
                    const isSelected = formTableIds.includes(table.id);
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleToggleTable(table.id)}
                        className={cn(
                          "relative px-2 py-1.5 rounded text-xs font-medium transition-all",
                          isSelected
                            ? "bg-blue-600 text-white ring-2 ring-blue-400"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                        )}
                        title={
                          table.isLoca
                            ? `Loca: ${table.locaName || table.label}`
                            : table.typeName || table.label
                        }
                      >
                        {table.isLoca ? `L${table.label}` : table.label}
                        {isSelected && (
                          <Check className="absolute -top-1 -right-1 w-3 h-3 text-white bg-blue-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Vardiya Saatleri */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Çalışma Saatleri
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">
                      Başlangıç
                    </label>
                    <Input
                      type="time"
                      value={formShiftStart}
                      onChange={(e) => setFormShiftStart(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">
                      Bitiş
                    </label>
                    <Input
                      type="time"
                      value={formShiftEnd}
                      onChange={(e) => setFormShiftEnd(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              {selectedStaff && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-300">
                    <User className="w-4 h-4" />
                    <span className="font-medium">
                      {selectedStaff.fullName}
                    </span>
                    <Badge
                      className="text-[10px]"
                      style={{
                        backgroundColor: `${STAFF_ROLES.find((r) => r.value === selectedRole)?.color || "#3b82f6"}25`,
                        color:
                          STAFF_ROLES.find((r) => r.value === selectedRole)
                            ?.color || "#3b82f6",
                      }}
                    >
                      {STAFF_ROLES.find((r) => r.value === selectedRole)?.label}
                    </Badge>
                  </div>
                  {formTableIds.length > 0 && (
                    <div className="text-xs text-blue-400 mt-1">
                      {formTableIds.length} masa • {formShiftStart} -{" "}
                      {formShiftEnd}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="border-slate-600"
              >
                Kapat
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4 mr-1" />
                Kaydet ve Devam Et
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
