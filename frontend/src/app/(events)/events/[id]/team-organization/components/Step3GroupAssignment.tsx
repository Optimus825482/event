"use client";

import { useState, useCallback, useMemo, memo } from "react";
import {
  GripVertical,
  Link2,
  Unlink,
  AlertCircle,
  CheckCircle,
  FolderOpen,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableGroup, TeamDefinition, TableData, StageElement } from "../types";
import { cn } from "@/lib/utils";

interface Step3GroupAssignmentProps {
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  tables?: TableData[];
  stageElements?: StageElement[];
  onAssignGroupToTeam: (groupId: string, teamId: string) => void;
  onUnassignGroup: (groupId: string) => void;
}

// ==================== DRAGGABLE GROUP CARD ====================
interface DraggableGroupCardProps {
  group: TableGroup;
  onDragStart: (groupId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onClick?: (group: TableGroup) => void;
}

const DraggableGroupCard = memo(function DraggableGroupCard({
  group,
  onDragStart,
  onDragEnd,
  isDragging,
  onClick,
}: DraggableGroupCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("groupId", group.id);
        onDragStart(group.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(group)}
      className={cn(
        "flex items-center gap-2 p-3 bg-slate-800 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 scale-95",
        "hover:bg-slate-700"
      )}
      style={{ borderColor: group.color }}
    >
      <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: group.color }}
      />
      <span className="text-sm font-medium text-white flex-1 truncate">
        {group.name}
      </span>
      <Badge
        variant="secondary"
        className="bg-slate-700 text-slate-300 text-xs"
      >
        {group.tableIds.length} masa
      </Badge>
      <Eye className="w-3 h-3 text-slate-500" />
    </div>
  );
});

// ==================== TEAM DROP ZONE ====================
interface TeamDropZoneProps {
  team: TeamDefinition;
  assignedGroups: TableGroup[];
  isDropTarget: boolean;
  onDrop: (groupId: string) => void;
  onUnassignGroup: (groupId: string) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onGroupClick?: (group: TableGroup) => void;
}

const TeamDropZone = memo(function TeamDropZone({
  team,
  assignedGroups,
  isDropTarget,
  onDrop,
  onUnassignGroup,
  onDragOver,
  onDragLeave,
  onGroupClick,
}: TeamDropZoneProps) {
  const totalTables = assignedGroups.reduce(
    (sum, g) => sum + g.tableIds.length,
    0
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDragOver();
    },
    [onDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const groupId = e.dataTransfer.getData("groupId");
      if (groupId) {
        onDrop(groupId);
      }
    },
    [onDrop]
  );

  return (
    <div
      className={cn(
        "bg-slate-800/50 rounded-lg border-2 p-4 transition-all min-h-[150px]",
        isDropTarget && "border-dashed bg-slate-700/50 scale-[1.02]"
      )}
      style={{ borderColor: isDropTarget ? "#a855f7" : team.color }}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {/* Team Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-semibold text-white">{team.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-700 text-slate-300 text-xs"
          >
            {assignedGroups.length} grup
          </Badge>
          <Badge
            variant="secondary"
            className="bg-slate-700 text-slate-300 text-xs"
          >
            {totalTables} masa
          </Badge>
        </div>
      </div>

      {/* Assigned Groups */}
      {assignedGroups.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg transition-colors",
            isDropTarget
              ? "border-purple-500 bg-purple-500/10"
              : "border-slate-600"
          )}
        >
          <FolderOpen
            className={cn(
              "w-8 h-8 mb-2",
              isDropTarget ? "text-purple-400" : "text-slate-600"
            )}
          />
          <p
            className={cn(
              "text-sm",
              isDropTarget ? "text-purple-400" : "text-slate-500"
            )}
          >
            {isDropTarget ? "Bırakın" : "Grup sürükleyip bırakın"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignedGroups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg group cursor-pointer hover:bg-slate-700"
              onClick={() => onGroupClick?.(group)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-sm text-slate-300">{group.name}</span>
                <span className="text-xs text-slate-500">
                  ({group.tableIds.length} masa)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnassignGroup(group.id);
                  }}
                  title="Atamayı kaldır"
                >
                  <Unlink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Drop hint when has groups */}
          {isDropTarget && (
            <div className="flex items-center justify-center py-2 border-2 border-dashed border-purple-500 rounded-lg bg-purple-500/10">
              <p className="text-sm text-purple-400">+ Ekle</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== MINI CANVAS PREVIEW ====================
interface MiniCanvasPreviewProps {
  tables: TableData[];
  stageElements: StageElement[];
  highlightedTableIds: string[];
  highlightColor: string;
}

const MiniCanvasPreview = memo(function MiniCanvasPreview({
  tables,
  stageElements,
  highlightedTableIds,
  highlightColor,
}: MiniCanvasPreviewProps) {
  // Calculate bounds to fit all elements
  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    tables.forEach((t) => {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + 40);
      maxY = Math.max(maxY, t.y + 40);
    });

    stageElements.forEach((s) => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    });

    const padding = 20;
    return {
      minX: minX - padding,
      minY: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [tables, stageElements]);

  // Scale to fit in container
  const containerWidth = 500;
  const containerHeight = 350;
  const scale = Math.min(
    containerWidth / bounds.width,
    containerHeight / bounds.height,
    1
  );

  return (
    <div
      className="relative bg-slate-900 rounded-lg overflow-hidden"
      style={{ width: containerWidth, height: containerHeight }}
    >
      <div
        className="absolute"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          left: (containerWidth - bounds.width * scale) / 2,
          top: (containerHeight - bounds.height * scale) / 2,
        }}
      >
        {/* Stage Elements */}
        {stageElements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: element.x - bounds.minX,
              top: element.y - bounds.minY,
              width: element.width,
              height: element.height,
            }}
          >
            <div
              className={cn(
                "w-full h-full rounded-lg flex items-center justify-center opacity-50",
                element.type === "stage"
                  ? "bg-blue-600"
                  : element.type === "system_control"
                  ? "bg-amber-600"
                  : "bg-purple-500"
              )}
            >
              <span className="text-[8px] font-medium text-white">
                {element.label}
              </span>
            </div>
          </div>
        ))}

        {/* Tables */}
        {tables.map((table) => {
          const isHighlighted = highlightedTableIds.includes(table.id);
          return (
            <div
              key={table.id}
              className="absolute"
              style={{
                left: table.x - bounds.minX,
                top: table.y - bounds.minY,
              }}
            >
              {/* Highlight glow */}
              {isHighlighted && (
                <div
                  className="absolute -inset-2 rounded-full animate-pulse"
                  style={{ backgroundColor: highlightColor, opacity: 0.4 }}
                />
              )}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-white border-2 transition-all",
                  isHighlighted ? "scale-125 z-10" : "opacity-40"
                )}
                style={{
                  backgroundColor: isHighlighted ? highlightColor : "#4b5563",
                  borderColor: isHighlighted ? "#fff" : "#6b7280",
                }}
              >
                <span className="text-[8px] font-bold">{table.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 right-2 bg-slate-800/90 rounded px-2 py-1 text-xs text-slate-400">
        <span className="text-white font-medium">
          {highlightedTableIds.length}
        </span>{" "}
        masa seçili
      </div>
    </div>
  );
});

// ==================== MAIN COMPONENT ====================
export function Step3GroupAssignment({
  tableGroups,
  teams,
  tables = [],
  stageElements = [],
  onAssignGroupToTeam,
  onUnassignGroup,
}: Step3GroupAssignmentProps) {
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dropTargetTeamId, setDropTargetTeamId] = useState<string | null>(null);
  const [previewGroup, setPreviewGroup] = useState<TableGroup | null>(null);

  // Unassigned groups
  const unassignedGroups = useMemo(
    () => tableGroups.filter((g) => !g.assignedTeamId),
    [tableGroups]
  );

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

  // Handlers
  const handleDragStart = useCallback((groupId: string) => {
    setDraggingGroupId(groupId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingGroupId(null);
    setDropTargetTeamId(null);
  }, []);

  const handleDrop = useCallback(
    (teamId: string, groupId: string) => {
      onAssignGroupToTeam(groupId, teamId);
      setDraggingGroupId(null);
      setDropTargetTeamId(null);
    },
    [onAssignGroupToTeam]
  );

  // Stats
  const assignedGroupsCount = tableGroups.filter(
    (g) => g.assignedTeamId
  ).length;
  const totalTablesAssigned = tableGroups
    .filter((g) => g.assignedTeamId)
    .reduce((sum, g) => sum + g.tableIds.length, 0);
  const totalTables = tableGroups.reduce(
    (sum, g) => sum + g.tableIds.length,
    0
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Grup Ataması</h2>
          <p className="text-sm text-slate-400">
            Masa gruplarını takımlara sürükleyip bırakın
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unassignedGroups.length === 0 ? (
            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Tüm gruplar atandı
            </Badge>
          ) : (
            <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">
              <AlertCircle className="w-3 h-3 mr-1" />
              {unassignedGroups.length} grup atanmadı
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel - Unassigned Groups (STICKY) */}
        <div className="w-72 flex-shrink-0 sticky top-0 self-start max-h-full flex flex-col bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              Atanmamış Gruplar
              <Badge variant="secondary" className="ml-auto bg-slate-700">
                {unassignedGroups.length}
              </Badge>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {unassignedGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
                <p className="text-sm">Tüm gruplar atandı</p>
              </div>
            ) : (
              unassignedGroups.map((group) => (
                <DraggableGroupCard
                  key={group.id}
                  group={group}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingGroupId === group.id}
                  onClick={setPreviewGroup}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Teams */}
        <div className="flex-1 overflow-y-auto">
          {teams.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
              <AlertCircle className="w-12 h-12 mx-auto text-amber-500/50 mb-3" />
              <h3 className="text-white font-medium mb-1">Takım bulunamadı</h3>
              <p className="text-sm text-slate-400">
                Önce Step 2'de takımları tanımlayın
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teams.map((team) => (
                <TeamDropZone
                  key={team.id}
                  team={team}
                  assignedGroups={groupsByTeam.get(team.id) || []}
                  isDropTarget={dropTargetTeamId === team.id}
                  onDrop={(groupId) => handleDrop(team.id, groupId)}
                  onUnassignGroup={onUnassignGroup}
                  onDragOver={() => setDropTargetTeamId(team.id)}
                  onDragLeave={() => setDropTargetTeamId(null)}
                  onGroupClick={setPreviewGroup}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            <span className="text-white font-medium">
              {assignedGroupsCount}
            </span>
            /{tableGroups.length} grup atandı
          </span>
          <span className="text-slate-400">
            <span className="text-white font-medium">
              {totalTablesAssigned}
            </span>
            /{totalTables} masa
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">
            Grupları sürükleyip takımlara bırakın
          </span>
        </div>
      </div>

      {/* Group Preview Modal */}
      <Dialog open={!!previewGroup} onOpenChange={() => setPreviewGroup(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: previewGroup?.color }}
              />
              {previewGroup?.name} - Yerleşim Planı
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {previewGroup && tables.length > 0 && (
              <MiniCanvasPreview
                tables={tables}
                stageElements={stageElements}
                highlightedTableIds={previewGroup.tableIds}
                highlightColor={previewGroup.color}
              />
            )}

            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-slate-400">
                  <span className="text-white font-medium">
                    {previewGroup?.tableIds.length}
                  </span>{" "}
                  masa bu grupta
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewGroup(null)}
                className="border-slate-600"
              >
                <X className="w-4 h-4 mr-1" />
                Kapat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
