"use client";

import { useState, useCallback, useMemo, memo } from "react";
import {
  Search,
  User,
  X,
  AlertCircle,
  CheckCircle,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TeamDefinition, Staff, StaffRole, STAFF_ROLES } from "../types";
import { cn } from "@/lib/utils";

// API_BASE for avatar URLs
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

// ==================== POSITION CATEGORIES ====================
// Yönetim pozisyonları - bunlar hariç tutulacak
const MANAGEMENT_POSITIONS = [
  "f&b manager",
  "asst. f&b manager",
  "f&b coordinator",
  "f&b office assistant",
  "manager",
  "director",
  "general manager",
  "assistant manager",
];

// Servis personeli kategorileri
interface StaffCategory {
  key: string;
  label: string;
  color: string;
  keywords: string[];
}

const STAFF_CATEGORIES: StaffCategory[] = [
  {
    key: "captain",
    label: "Kaptan",
    color: "#f59e0b",
    keywords: ["captain", "kaptan", "supervisor", "maitre"],
  },
  {
    key: "waiter",
    label: "Garson",
    color: "#3b82f6",
    keywords: ["waiter", "waitress", "garson"],
  },
  {
    key: "commis",
    label: "Komi",
    color: "#22c55e",
    keywords: ["commis", "komi", "runner", "debaras"],
  },
  {
    key: "barman",
    label: "Barmen / Barista",
    color: "#8b5cf6",
    keywords: ["barman", "barmaid", "bartender", "barmen", "barista"],
  },
  {
    key: "hostess",
    label: "Hostes",
    color: "#ec4899",
    keywords: ["host", "hostess", "hostes"],
  },
];

// Pozisyonun kategorisini bul
function getStaffCategory(position?: string): StaffCategory | null {
  if (!position) return null;
  const posLower = position.toLowerCase();

  // Yönetim pozisyonlarını hariç tut
  if (MANAGEMENT_POSITIONS.some((mp) => posLower.includes(mp))) {
    return null;
  }

  // Kategori bul
  for (const cat of STAFF_CATEGORIES) {
    if (cat.keywords.some((kw) => posLower.includes(kw))) {
      return cat;
    }
  }

  return null;
}

// Yönetim pozisyonu mu kontrol et
function isManagementPosition(position?: string): boolean {
  if (!position) return false;
  const posLower = position.toLowerCase();
  return MANAGEMENT_POSITIONS.some((mp) => posLower.includes(mp));
}

interface Step4StaffAssignmentProps {
  teams: TeamDefinition[];
  allStaff: Staff[];
  onAssignStaff: (teamId: string, role: StaffRole, staffId: string) => void;
  onUnassignStaff: (teamId: string, role: StaffRole, staffId: string) => void;
}

// ==================== STAFF CARD ====================
interface StaffCardProps {
  staff: Staff;
  isAssigned: boolean;
  onDragStart: (staffId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

const StaffCard = memo(function StaffCard({
  staff,
  isAssigned,
  onDragStart,
  onDragEnd,
  isDragging,
}: StaffCardProps) {
  // Pozisyon kısaltması
  const shortPosition = useMemo(() => {
    if (!staff.position) return null;
    // Uzun pozisyon isimlerini kısalt
    const pos = staff.position;
    if (pos.length > 20) {
      return pos.substring(0, 18) + "...";
    }
    return pos;
  }, [staff.position]);

  return (
    <div
      draggable={!isAssigned}
      onDragStart={(e) => {
        if (isAssigned) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("staffId", staff.id);
        onDragStart(staff.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2 p-2 bg-slate-800 rounded-lg border transition-all",
        isAssigned
          ? "border-slate-700 opacity-50 cursor-not-allowed"
          : "border-slate-600 cursor-grab active:cursor-grabbing hover:bg-slate-700",
        isDragging && "opacity-50 scale-95"
      )}
    >
      {!isAssigned && (
        <GripVertical className="w-3 h-3 text-slate-500 flex-shrink-0" />
      )}
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={getAvatarUrl(staff.avatar)} />
        <AvatarFallback className="bg-slate-700 text-xs">
          {staff.fullName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{staff.fullName}</p>
        {shortPosition && (
          <p className="text-xs text-slate-500 truncate">{shortPosition}</p>
        )}
      </div>
      {isAssigned && (
        <Badge
          variant="secondary"
          className="bg-emerald-600/20 text-emerald-400 text-xs flex-shrink-0"
        >
          Atandı
        </Badge>
      )}
    </div>
  );
});

// ==================== CATEGORY SECTION ====================
interface CategorySectionProps {
  category: StaffCategory;
  staffList: Staff[];
  assignedStaffIds: Set<string>;
  draggingStaffId: string | null;
  onDragStart: (staffId: string) => void;
  onDragEnd: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const CategorySection = memo(function CategorySection({
  category,
  staffList,
  assignedStaffIds,
  draggingStaffId,
  onDragStart,
  onDragEnd,
  isExpanded,
  onToggle,
}: CategorySectionProps) {
  const availableCount = staffList.filter(
    (s) => !assignedStaffIds.has(s.id)
  ).length;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2.5 bg-slate-800/80 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm font-medium text-white">
            {category.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-700 text-slate-300 text-xs"
          >
            {availableCount} müsait
          </Badge>
          <Badge
            variant="secondary"
            className="bg-slate-700/50 text-slate-400 text-xs"
          >
            {staffList.length} toplam
          </Badge>
        </div>
      </button>

      {/* Staff List */}
      {isExpanded && (
        <div className="p-2 space-y-1.5 bg-slate-900/30 max-h-[200px] overflow-y-auto">
          {staffList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              Bu kategoride personel yok
            </p>
          ) : (
            staffList.map((staff) => (
              <StaffCard
                key={staff.id}
                staff={staff}
                isAssigned={assignedStaffIds.has(staff.id)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggingStaffId === staff.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

// ==================== TEAM STAFF PANEL ====================
interface TeamStaffPanelProps {
  team: TeamDefinition;
  allStaff: Staff[];
  draggingStaffId: string | null;
  dropTargetRole: { teamId: string; role: StaffRole } | null;
  onDrop: (teamId: string, role: StaffRole, staffId: string) => void;
  onUnassign: (teamId: string, role: StaffRole, staffId: string) => void;
  onDragOver: (teamId: string, role: StaffRole) => void;
  onDragLeave: () => void;
}

const TeamStaffPanel = memo(function TeamStaffPanel({
  team,
  allStaff,
  draggingStaffId,
  dropTargetRole,
  onDrop,
  onUnassign,
  onDragOver,
  onDragLeave,
}: TeamStaffPanelProps) {
  const totalRequired = team.requiredStaff.reduce((sum, r) => sum + r.count, 0);
  const totalAssigned = team.requiredStaff.reduce(
    (sum, r) => sum + r.assignedStaffIds.length,
    0
  );
  const isComplete = totalAssigned >= totalRequired;

  return (
    <div
      className="bg-slate-800/50 rounded-lg border-2 p-4"
      style={{ borderColor: team.color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-semibold text-white">{team.name}</span>
        </div>
        <Badge
          className={cn(
            "text-xs",
            isComplete
              ? "bg-emerald-600/20 text-emerald-400"
              : "bg-amber-600/20 text-amber-400"
          )}
        >
          {isComplete ? (
            <CheckCircle className="w-3 h-3 mr-1" />
          ) : (
            <AlertCircle className="w-3 h-3 mr-1" />
          )}
          {totalAssigned}/{totalRequired}
        </Badge>
      </div>

      {/* Role Sections */}
      {team.requiredStaff.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          Personel gereksinimi tanımlanmamış
        </p>
      ) : (
        <div className="space-y-3">
          {team.requiredStaff.map((req) => {
            const roleInfo = STAFF_ROLES.find((r) => r.value === req.role);
            const assignedStaff = req.assignedStaffIds
              .map((id) => allStaff.find((s) => s.id === id))
              .filter(Boolean) as Staff[];
            const isDropTarget =
              dropTargetRole?.teamId === team.id &&
              dropTargetRole?.role === req.role;
            const isFull = assignedStaff.length >= req.count;

            return (
              <div key={req.role} className="space-y-1.5">
                {/* Role Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: roleInfo?.color }}
                    />
                    <span className="text-sm text-slate-300">
                      {roleInfo?.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      isFull ? "text-emerald-400" : "text-slate-500"
                    )}
                  >
                    {assignedStaff.length}/{req.count}
                  </span>
                </div>

                {/* Drop Zone */}
                <div
                  className={cn(
                    "min-h-[40px] rounded-lg border-2 border-dashed p-2 transition-all",
                    isDropTarget && !isFull
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-700",
                    isFull && "opacity-50"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isFull) {
                      onDragOver(team.id, req.role);
                    }
                  }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => {
                    e.preventDefault();
                    const staffId = e.dataTransfer.getData("staffId");
                    if (staffId && !isFull) {
                      onDrop(team.id, req.role, staffId);
                    }
                  }}
                >
                  {assignedStaff.length === 0 ? (
                    <p
                      className={cn(
                        "text-xs text-center py-1",
                        isDropTarget ? "text-purple-400" : "text-slate-600"
                      )}
                    >
                      {isDropTarget ? "Bırakın" : "Personel sürükleyin"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {assignedStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 group"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={getAvatarUrl(staff.avatar)} />
                            <AvatarFallback className="bg-slate-600 text-[8px]">
                              {staff.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-slate-300 max-w-[80px] truncate">
                            {staff.fullName}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                            onClick={() =>
                              onUnassign(team.id, req.role, staff.id)
                            }
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ==================== MAIN COMPONENT ====================
export function Step4StaffAssignment({
  teams,
  allStaff,
  onAssignStaff,
  onUnassignStaff,
}: Step4StaffAssignmentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingStaffId, setDraggingStaffId] = useState<string | null>(null);
  const [dropTargetRole, setDropTargetRole] = useState<{
    teamId: string;
    role: StaffRole;
  } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(STAFF_CATEGORIES.map((c) => c.key))
  );

  // Get all assigned staff IDs
  const assignedStaffIds = useMemo(() => {
    const ids = new Set<string>();
    teams.forEach((team) => {
      team.requiredStaff.forEach((req) => {
        req.assignedStaffIds.forEach((id) => ids.add(id));
      });
    });
    return ids;
  }, [teams]);

  // Filter out management and inactive staff, then group by category
  const staffByCategory = useMemo(() => {
    const categoryMap = new Map<string, Staff[]>();

    // Initialize all categories
    STAFF_CATEGORIES.forEach((cat) => {
      categoryMap.set(cat.key, []);
    });

    // Filter and categorize staff
    allStaff.forEach((staff) => {
      // Skip inactive staff
      if (!staff.isActive) return;

      // Skip management positions
      if (isManagementPosition(staff.position)) return;

      // Search filter
      if (
        searchQuery &&
        !staff.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      // Get category
      const category = getStaffCategory(staff.position);
      if (category) {
        const list = categoryMap.get(category.key) || [];
        list.push(staff);
        categoryMap.set(category.key, list);
      }
    });

    return categoryMap;
  }, [allStaff, searchQuery]);

  // Total available staff count (excluding management)
  const totalServiceStaff = useMemo(() => {
    let count = 0;
    staffByCategory.forEach((list) => {
      count += list.length;
    });
    return count;
  }, [staffByCategory]);

  const availableServiceStaff = useMemo(() => {
    let count = 0;
    staffByCategory.forEach((list) => {
      count += list.filter((s) => !assignedStaffIds.has(s.id)).length;
    });
    return count;
  }, [staffByCategory, assignedStaffIds]);

  // Stats
  const totalRequired = teams.reduce(
    (sum, t) => sum + t.requiredStaff.reduce((s, r) => s + r.count, 0),
    0
  );
  const totalAssigned = assignedStaffIds.size;

  // Handlers
  const handleDragStart = useCallback((staffId: string) => {
    setDraggingStaffId(staffId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingStaffId(null);
    setDropTargetRole(null);
  }, []);

  const handleDrop = useCallback(
    (teamId: string, role: StaffRole, staffId: string) => {
      onAssignStaff(teamId, role, staffId);
      setDraggingStaffId(null);
      setDropTargetRole(null);
    },
    [onAssignStaff]
  );

  const toggleCategory = useCallback((categoryKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Personel Atama</h2>
          <p className="text-sm text-slate-400">
            Personeli takımlara sürükleyip bırakın
          </p>
        </div>
        <Badge
          className={cn(
            "text-sm",
            totalAssigned >= totalRequired
              ? "bg-emerald-600/20 text-emerald-400"
              : "bg-amber-600/20 text-amber-400"
          )}
        >
          {totalAssigned >= totalRequired ? (
            <CheckCircle className="w-4 h-4 mr-1" />
          ) : (
            <AlertCircle className="w-4 h-4 mr-1" />
          )}
          {totalAssigned}/{totalRequired} personel atandı
        </Badge>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel - Staff Pool by Category */}
        <div className="w-96 flex flex-col bg-slate-800/30 rounded-lg border border-slate-700">
          {/* Search */}
          <div className="p-3 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Personel ara..."
                className="pl-8 h-9 bg-slate-700 border-slate-600"
              />
            </div>
          </div>

          {/* Category Sections */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {STAFF_CATEGORIES.map((category) => {
              const staffList = staffByCategory.get(category.key) || [];
              return (
                <CategorySection
                  key={category.key}
                  category={category}
                  staffList={staffList}
                  assignedStaffIds={assignedStaffIds}
                  draggingStaffId={draggingStaffId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isExpanded={expandedCategories.has(category.key)}
                  onToggle={() => toggleCategory(category.key)}
                />
              );
            })}
          </div>

          {/* Pool Stats */}
          <div className="p-2 border-t border-slate-700 text-xs text-slate-500">
            {availableServiceStaff} müsait / {totalServiceStaff} servis
            personeli
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
                <TeamStaffPanel
                  key={team.id}
                  team={team}
                  allStaff={allStaff}
                  draggingStaffId={draggingStaffId}
                  dropTargetRole={dropTargetRole}
                  onDrop={handleDrop}
                  onUnassign={onUnassignStaff}
                  onDragOver={(teamId, role) =>
                    setDropTargetRole({ teamId, role })
                  }
                  onDragLeave={() => setDropTargetRole(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
