"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Users,
  UserPlus,
  Clock,
  Check,
  X,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  TableData,
  TableGroup,
  TeamDefinition,
  Staff,
  StaffRole,
  STAFF_ROLES,
  GroupStaffAssignment,
  StageElement,
  WorkShift,
  CUSTOM_SHIFT_OPTION,
  ServicePoint,
  SERVICE_POINT_ROLES,
  DEFAULT_COLORS,
} from "../types";
import {
  useCanvasInteraction,
  CanvasTool,
} from "../hooks/useCanvasInteraction";
import { CanvasRenderer, CanvasToolbar } from "./CanvasRenderer";
import { cn } from "@/lib/utils";

// ==================== AVATAR HELPER ====================
// Backend base URL - /api olmadan
const API_BASE_URL = (() => {
  const apiUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
      : "http://localhost:4000/api";
  // /api kısmını kaldır
  return apiUrl.replace("/api", "");
})();

function getAvatarUrl(avatar: string | undefined | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("http")) return avatar;
  if (avatar.startsWith("/")) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/${avatar}`;
}

// ==================== STAFF AVATAR COMPONENT ====================
interface StaffAvatarProps {
  staff: Staff;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function StaffAvatar({ staff, size = "md", className }: StaffAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = getAvatarUrl(staff.avatar);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={staff.fullName}
        className={cn(
          "rounded-full object-cover border-2 border-slate-600",
          sizeClasses[size],
          className
        )}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold border-2 border-slate-600",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: staff.color || "#6b7280" }}
    >
      {staff.fullName.charAt(0).toUpperCase()}
    </div>
  );
}

// Ekstra personel tipi (hook'tan gelen)
interface ExtraStaffItem {
  id: string;
  fullName: string;
  position?: string;
  role?: string;
  shiftStart?: string;
  shiftEnd?: string;
  color?: string;
  notes?: string;
  assignedGroups?: string[];
  assignedTables?: string[];
  sortOrder?: number;
  isActive?: boolean;
  workLocation?: string;
}

interface Step2StaffAssignmentProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  allStaff: Staff[];
  eventShifts: WorkShift[]; // Etkinliğe özel vardiyalar
  stageElements?: StageElement[];
  servicePoints?: ServicePoint[];
  // Ekstra personel (parent'tan yönetilen)
  extraStaffList?: ExtraStaffItem[];
  onExtraStaffListChange?: (list: ExtraStaffItem[]) => void;
  onAssignStaffToGroup: (
    groupId: string,
    assignments: GroupStaffAssignment[]
  ) => void;
  onRemoveStaffFromGroup: (groupId: string, assignmentId: string) => void;
  onUpdateStaffAssignment: (
    groupId: string,
    assignmentId: string,
    updates: Partial<GroupStaffAssignment>
  ) => void;
  // Hizmet noktası personel ataması
  onAssignStaffToServicePoint?: (
    servicePointId: string,
    staffId: string,
    role: string,
    shiftStart: string,
    shiftEnd: string
  ) => void;
  onRemoveStaffFromServicePoint?: (
    servicePointId: string,
    assignmentId: string
  ) => void;
  // Canvas toolbar callbacks (lifted up to parent)
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

// Personel seçim state'i
interface SelectedStaffItem {
  staffId: string;
  role: StaffRole | string; // string for service point roles
}

// Her personel için vardiya state'i
interface StaffShiftState {
  shiftId: string; // "custom" veya gerçek shift ID
  shiftStart: string;
  shiftEnd: string;
}

// ==================== STAFF ACCORDION GROUP ====================
interface StaffAccordionGroupProps {
  position: string;
  staffList: Staff[];
  selectedRole: StaffRole | string | null;
  selectedStaffItems: SelectedStaffItem[];
  onToggleStaff: (staffId: string, role: StaffRole | string) => void;
}

function StaffAccordionGroup({
  position,
  staffList,
  selectedRole,
  selectedStaffItems,
  onToggleStaff,
}: StaffAccordionGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedInGroup = staffList.filter((staff) =>
    selectedStaffItems.some(
      (s) => s.staffId === staff.id && s.role === selectedRole
    )
  ).length;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-700/50 hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-medium text-white">{position}</span>
          <Badge variant="secondary" className="text-xs bg-slate-600">
            {staffList.length} kişi
          </Badge>
        </div>
        {selectedInGroup > 0 && (
          <Badge className="bg-blue-600 text-xs">
            {selectedInGroup} seçili
          </Badge>
        )}
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-2 space-y-1 bg-slate-800/30">
          {staffList.map((staff) => {
            const isSelected = selectedStaffItems.some(
              (s) => s.staffId === staff.id && s.role === selectedRole
            );

            // Avatar URL'ini düzelt - backend'den gelen path'i tam URL'e çevir
            const avatarUrl = staff.avatar
              ? staff.avatar.startsWith("http")
                ? staff.avatar
                : `${
                    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
                  }${staff.avatar}`
              : null;

            return (
              <div
                key={staff.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                  isSelected
                    ? "bg-blue-600/20 border border-blue-500/50 ring-1 ring-blue-500/30"
                    : "bg-slate-700/30 hover:bg-slate-700/60 border border-transparent"
                )}
                onClick={() =>
                  selectedRole && onToggleStaff(staff.id, selectedRole)
                }
              >
                <Checkbox
                  checked={isSelected}
                  className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />

                {/* Avatar */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={staff.fullName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
                    onError={(e) => {
                      // Resim yüklenemezse fallback göster
                      (e.target as HTMLImageElement).style.display = "none";
                      (
                        e.target as HTMLImageElement
                      ).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-slate-600",
                    avatarUrl && "hidden"
                  )}
                  style={{ backgroundColor: staff.color || "#6b7280" }}
                >
                  {staff.fullName.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {staff.fullName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {staff.position || "Pozisyon belirtilmemiş"}
                  </p>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Step2StaffAssignment({
  tables,
  tableGroups,
  teams,
  allStaff,
  eventShifts,
  stageElements = [],
  servicePoints = [],
  extraStaffList: externalExtraStaffList,
  onExtraStaffListChange,
  onAssignStaffToGroup,
  onRemoveStaffFromGroup,
  onUpdateStaffAssignment,
  onAssignStaffToServicePoint,
  onRemoveStaffFromServicePoint,
  onCanvasStateChange,
}: Step2StaffAssignmentProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas interaction
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
    handleTableClick,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleSelectAll,
    handleClearSelection,
  } = useCanvasInteraction({ tables });

  // Local state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedServicePointId, setSelectedServicePointId] = useState<
    string | null
  >(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showExtraStaffModal, setShowExtraStaffModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<StaffRole | string | null>(
    null
  );
  const [selectedStaffItems, setSelectedStaffItems] = useState<
    SelectedStaffItem[]
  >([]);
  // Atama modu: "group" veya "servicePoint"
  const [assignmentMode, setAssignmentMode] = useState<
    "group" | "servicePoint"
  >("group");
  // Her personel için ayrı vardiya bilgisi
  const [staffShifts, setStaffShifts] = useState<
    Record<string, StaffShiftState>
  >({});
  // Ekstra personel listesi - parent'tan geliyorsa onu kullan, yoksa local state
  const [localExtraStaffList, setLocalExtraStaffList] = useState<
    ExtraStaffItem[]
  >([]);
  const extraStaffList = externalExtraStaffList ?? localExtraStaffList;

  // setExtraStaffList wrapper - hem callback hem direct value destekler
  const setExtraStaffList = useCallback(
    (
      valueOrUpdater:
        | ExtraStaffItem[]
        | ((prev: ExtraStaffItem[]) => ExtraStaffItem[])
    ) => {
      if (typeof valueOrUpdater === "function") {
        const newValue = valueOrUpdater(extraStaffList);
        if (onExtraStaffListChange) {
          onExtraStaffListChange(newValue);
        } else {
          setLocalExtraStaffList(newValue);
        }
      } else {
        if (onExtraStaffListChange) {
          onExtraStaffListChange(valueOrUpdater);
        } else {
          setLocalExtraStaffList(valueOrUpdater);
        }
      }
    },
    [extraStaffList, onExtraStaffListChange]
  );
  // Ekstra personel form state
  const [extraStaffForm, setExtraStaffForm] = useState({
    fullName: "",
    position: "",
    shiftStart: "18:00",
    shiftEnd: "02:00",
  });

  // Varsayılan vardiya (ilk aktif vardiya veya fallback - custom)
  const defaultShift = useMemo(() => {
    const firstShift = eventShifts.find((s) => s.isActive);
    // Vardiya yoksa custom olarak ayarla
    if (!firstShift) {
      return { id: "custom", startTime: "18:00", endTime: "02:00" };
    }
    return firstShift;
  }, [eventShifts]);

  // Vardiya var mı kontrolü
  const hasEventShifts = useMemo(() => {
    return eventShifts.filter((s) => s.isActive).length > 0;
  }, [eventShifts]);

  // Expose canvas state to parent for toolbar
  // Refs to avoid infinite loops - fonksiyonları ref'te tutuyoruz
  const canvasActionsRef = useRef({
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    setActiveTool,
    handleSelectAll,
  });

  // Her render'da ref'i güncelle (effect tetiklemeden)
  canvasActionsRef.current = {
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    setActiveTool,
    handleSelectAll,
  };

  useEffect(() => {
    if (onCanvasStateChange) {
      onCanvasStateChange({
        zoom,
        activeTool,
        onZoomIn: () => canvasActionsRef.current.handleZoomIn(),
        onZoomOut: () => canvasActionsRef.current.handleZoomOut(),
        onResetView: () => canvasActionsRef.current.handleResetView(),
        onToolChange: (tool) => canvasActionsRef.current.setActiveTool(tool),
        onSelectAll: () => canvasActionsRef.current.handleSelectAll(),
      });
    }
  }, [zoom, activeTool, onCanvasStateChange]);

  // Table -> Group map
  const tableToGroupMap = useMemo(() => {
    const map = new Map<string, TableGroup>();
    tableGroups.forEach((group) => {
      group.tableIds.forEach((tableId) => map.set(tableId, group));
    });
    return map;
  }, [tableGroups]);

  const getTableGroup = useCallback(
    (tableId: string) => tableToGroupMap.get(tableId),
    [tableToGroupMap]
  );

  // Get team for group
  const getTeamForGroup = useCallback(
    (groupId: string) => {
      const group = tableGroups.find((g) => g.id === groupId);
      if (!group?.assignedTeamId) return null;
      return teams.find((t) => t.id === group.assignedTeamId);
    },
    [tableGroups, teams]
  );

  // Tüm gruplardaki atanmış personel ID'lerini topla
  const assignedStaffIds = useMemo(() => {
    const ids = new Set<string>();
    tableGroups.forEach((group) => {
      group.staffAssignments?.forEach((assignment) => {
        ids.add(assignment.staffId);
      });
    });
    // Hizmet noktalarındaki atamaları da ekle
    servicePoints.forEach((sp) => {
      sp.staffAssignments?.forEach((assignment) => {
        ids.add(assignment.staffId);
      });
    });
    return ids;
  }, [tableGroups, servicePoints]);

  // Yönetim pozisyonları - listeden hariç tutulacak
  const EXCLUDED_POSITIONS = [
    "F&B Manager",
    "Asst. F&B Manager",
    "F&B Coordinator",
    "F&B Office Assistant",
    "Assistant F&B Manager",
  ];

  // Group staff by position - sadece atanmamış personeller + ekstra personeller (yönetim hariç)
  const staffByPosition = useMemo(() => {
    const grouped: Record<string, Staff[]> = {};

    // Normal personeller
    allStaff.forEach((staff) => {
      // Zaten atanmış personelleri atla
      if (assignedStaffIds.has(staff.id)) return;

      const position = staff.position || "Diğer";

      // Yönetim pozisyonlarını hariç tut
      if (
        EXCLUDED_POSITIONS.some((excluded) =>
          position.toLowerCase().includes(excluded.toLowerCase())
        )
      )
        return;

      if (!grouped[position]) grouped[position] = [];
      grouped[position].push(staff);
    });

    // Ekstra personeller - "Ekstra Personel" grubu altında
    // ExtraStaffItem'ı Staff formatına dönüştür
    if (extraStaffList.length > 0) {
      const unassignedExtras = extraStaffList
        .filter((staff) => !assignedStaffIds.has(staff.id))
        .map(
          (es): Staff => ({
            id: es.id,
            fullName: es.fullName,
            email: "",
            phone: "",
            color: es.color || DEFAULT_COLORS[0],
            position: es.position || "Ekstra",
            workLocation: es.workLocation || "Ekstra Personel",
            department: "Ekstra",
            avatar: undefined,
            isActive: es.isActive ?? true,
          })
        );
      if (unassignedExtras.length > 0) {
        grouped["Ekstra Personel"] = unassignedExtras;
      }
    }

    return grouped;
  }, [allStaff, assignedStaffIds, extraStaffList]);

  // Seçili hizmet noktası
  const selectedServicePoint = useMemo(
    () => servicePoints.find((sp) => sp.id === selectedServicePointId),
    [servicePoints, selectedServicePointId]
  );

  // Handle table click - select group
  const handleTableClickWithGroup = useCallback(
    (tableId: string, e: React.MouseEvent) => {
      handleTableClick(tableId, e, getTableGroup);
      const group = getTableGroup(tableId);
      if (group) {
        setSelectedGroupId(group.id);
        setSelectedServicePointId(null); // Hizmet noktası seçimini temizle
        setSelectedTableIds(group.tableIds);
      }
    },
    [handleTableClick, getTableGroup, setSelectedTableIds]
  );

  // Handle service point click
  const handleServicePointClick = useCallback(
    (servicePointId: string) => {
      setSelectedServicePointId(servicePointId);
      setSelectedGroupId(null); // Grup seçimini temizle
      setSelectedTableIds([]);
    },
    [setSelectedTableIds]
  );

  // Open staff selection modal for a role (grup için)
  const handleOpenStaffModal = useCallback((role: StaffRole) => {
    setAssignmentMode("group");
    setSelectedRole(role);
    setSelectedStaffItems([]);
    setShowStaffModal(true);
  }, []);

  // Open staff selection modal for service point role
  const handleOpenServicePointStaffModal = useCallback((role: string) => {
    setAssignmentMode("servicePoint");
    setSelectedRole(role);
    setSelectedStaffItems([]);
    setShowStaffModal(true);
  }, []);

  // Ekstra personel ekleme
  const handleAddExtraStaff = useCallback(() => {
    if (!extraStaffForm.fullName.trim() || !extraStaffForm.position) return;

    const newExtraStaff: ExtraStaffItem = {
      id: `extra-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fullName: extraStaffForm.fullName.trim(),
      position: extraStaffForm.position,
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      workLocation: "Ekstra Personel",
      shiftStart: extraStaffForm.shiftStart,
      shiftEnd: extraStaffForm.shiftEnd,
      isActive: true,
    };

    if (onExtraStaffListChange) {
      onExtraStaffListChange([...(extraStaffList || []), newExtraStaff]);
    }
    setExtraStaffForm({
      fullName: "",
      position: "",
      shiftStart: "18:00",
      shiftEnd: "02:00",
    });
    setShowExtraStaffModal(false);
  }, [extraStaffForm, extraStaffList, onExtraStaffListChange]);

  // Toggle staff selection
  const handleToggleStaff = useCallback(
    (staffId: string, role: StaffRole | string) => {
      setSelectedStaffItems((prev) => {
        const exists = prev.find(
          (s) => s.staffId === staffId && s.role === role
        );
        if (exists) {
          return prev.filter(
            (s) => !(s.staffId === staffId && s.role === role)
          );
        }
        return [...prev, { staffId, role }];
      });
    },
    []
  );

  // Confirm staff selection - open shift modal
  const handleConfirmStaffSelection = useCallback(() => {
    if (selectedStaffItems.length === 0) return;
    // Her personel için varsayılan vardiya ayarla
    const initialShifts: Record<string, StaffShiftState> = {};
    selectedStaffItems.forEach((item) => {
      initialShifts[item.staffId] = {
        shiftId: defaultShift.id,
        shiftStart: defaultShift.startTime,
        shiftEnd: defaultShift.endTime,
      };
    });
    setStaffShifts(initialShifts);
    setShowStaffModal(false);
    setShowShiftModal(true);
  }, [selectedStaffItems, defaultShift]);

  // Personel için vardiya seç
  const handleSelectShift = useCallback(
    (staffId: string, shiftId: string) => {
      if (shiftId === "custom") {
        // Özel seçildi - mevcut saatleri koru veya varsayılan ata
        setStaffShifts((prev) => ({
          ...prev,
          [staffId]: {
            shiftId: "custom",
            shiftStart: prev[staffId]?.shiftStart || "18:00",
            shiftEnd: prev[staffId]?.shiftEnd || "02:00",
          },
        }));
      } else {
        // Hazır vardiya seçildi
        const shift = eventShifts.find((s) => s.id === shiftId);
        if (shift) {
          setStaffShifts((prev) => ({
            ...prev,
            [staffId]: {
              shiftId: shift.id,
              shiftStart: shift.startTime,
              shiftEnd: shift.endTime,
            },
          }));
        }
      }
    },
    [eventShifts]
  );

  // Özel vardiya saati güncelle
  const handleUpdateCustomShift = useCallback(
    (staffId: string, field: "shiftStart" | "shiftEnd", value: string) => {
      setStaffShifts((prev) => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          shiftId: "custom", // Manuel değişiklik yapıldığında custom'a çevir
          [field]: value,
        },
      }));
    },
    []
  );

  // Confirm shift and save assignments
  const handleConfirmShift = useCallback(() => {
    if (selectedStaffItems.length === 0) return;

    if (assignmentMode === "group" && selectedGroupId) {
      // Grup için atama - ekstra personel de atanabilir
      const assignments: GroupStaffAssignment[] = selectedStaffItems.map(
        (item) => ({
          id: `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          staffId: item.staffId,
          role: item.role as StaffRole,
          shiftId:
            staffShifts?.[item.staffId]?.shiftId !== "custom"
              ? staffShifts?.[item.staffId]?.shiftId
              : undefined,
          shiftStart: staffShifts?.[item.staffId]?.shiftStart || "18:00",
          shiftEnd: staffShifts?.[item.staffId]?.shiftEnd || "02:00",
        })
      );

      onAssignStaffToGroup(selectedGroupId, assignments);
    } else if (
      assignmentMode === "servicePoint" &&
      selectedServicePointId &&
      onAssignStaffToServicePoint
    ) {
      // Hizmet noktası için atama - sadece gerçek personel (ekstra personel hariç)
      const realStaffItems = selectedStaffItems.filter(
        (item) => !item.staffId.startsWith("extra-")
      );
      const extraStaffItems = selectedStaffItems.filter((item) =>
        item.staffId.startsWith("extra-")
      );

      // Ekstra personel varsa uyarı göster
      if (extraStaffItems.length > 0) {
        alert(
          `⚠️ Ekstra personel hizmet noktalarına atanamaz.\n\n${extraStaffItems.length} ekstra personel atlanadı.\nEkstra personeli sadece masa gruplarına atayabilirsiniz.`
        );
      }

      // Sadece gerçek personeli ata
      realStaffItems.forEach((item) => {
        onAssignStaffToServicePoint(
          selectedServicePointId,
          item.staffId,
          item.role as string,
          staffShifts?.[item.staffId]?.shiftStart || "18:00",
          staffShifts?.[item.staffId]?.shiftEnd || "02:00"
        );
      });
    }

    // Reset state
    setShowShiftModal(false);
    setSelectedStaffItems([]);
    setStaffShifts({});
    setSelectedRole(null);
  }, [
    assignmentMode,
    selectedGroupId,
    selectedServicePointId,
    selectedStaffItems,
    staffShifts,
    onAssignStaffToGroup,
    onAssignStaffToServicePoint,
  ]);

  // Get selected group
  const selectedGroup = useMemo(
    () => tableGroups.find((g) => g.id === selectedGroupId),
    [tableGroups, selectedGroupId]
  );

  // Get staff name by id
  const getStaffName = useCallback(
    (staffId: string) => {
      // Önce allStaff'ta ara, yoksa extraStaffList'te ara
      const staff =
        allStaff.find((s) => s.id === staffId) ||
        extraStaffList.find((s) => s.id === staffId);
      return staff?.fullName || "Bilinmeyen";
    },
    [allStaff, extraStaffList]
  );

  // Get role label
  const getRoleLabel = useCallback((role: StaffRole | string) => {
    // Önce STAFF_ROLES'da ara
    const staffRole = STAFF_ROLES.find((r) => r.value === role);
    if (staffRole) return staffRole.label;
    // Sonra SERVICE_POINT_ROLES'da ara
    const spRole = SERVICE_POINT_ROLES.find((r) => r.value === role);
    if (spRole) return spRole.label;
    return role;
  }, []);

  // Get role color
  const getRoleColor = useCallback((role: StaffRole | string) => {
    // Önce STAFF_ROLES'da ara
    const staffRole = STAFF_ROLES.find((r) => r.value === role);
    if (staffRole) return staffRole.color;
    // Sonra SERVICE_POINT_ROLES'da ara
    const spRole = SERVICE_POINT_ROLES.find((r) => r.value === role);
    if (spRole) return spRole.color;
    return "#6b7280";
  }, []);

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-[660px]">
        {/* Left Panel - Group Staff List */}
        <div className="w-80 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col flex-shrink-0 h-full">
          {/* Header */}
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white mb-1">
              Personel Atamaları
            </h3>
            <p className="text-xs text-slate-400">
              Canvas'ta gruba sağ tıklayarak personel ekleyin
            </p>
          </div>

          {/* Selected Group Info */}
          {selectedGroup ? (
            <div className="p-3 border-b border-slate-700 bg-slate-800/30">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedGroup.color }}
                />
                <span className="font-medium text-white">
                  {selectedGroup.name}
                </span>
                {getTeamForGroup(selectedGroup.id) && (
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: `${
                        getTeamForGroup(selectedGroup.id)?.color
                      }20`,
                      color: getTeamForGroup(selectedGroup.id)?.color,
                    }}
                  >
                    {getTeamForGroup(selectedGroup.id)?.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {selectedGroup.tableIds.length} masa •{" "}
                {selectedGroup.staffAssignments?.length || 0} personel atandı
              </p>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Grup seçilmedi</p>
              <p className="text-xs mt-1">Canvas'ta bir gruba tıklayın</p>
            </div>
          )}

          {/* Staff Assignments List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {/* Grup Personel Atamaları */}
            {selectedGroup?.staffAssignments?.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-700/50 rounded-lg p-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getRoleColor(assignment.role) }}
                  />
                  <div>
                    <p className="text-sm text-white">
                      {getStaffName(assignment.staffId)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {getRoleLabel(assignment.role)} • {assignment.shiftStart}{" "}
                      - {assignment.shiftEnd}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-400 hover:text-red-400"
                  onClick={() =>
                    onRemoveStaffFromGroup(selectedGroup.id, assignment.id)
                  }
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}

            {selectedGroup &&
              (!selectedGroup.staffAssignments ||
                selectedGroup.staffAssignments.length === 0) && (
                <div className="text-center py-4 text-slate-500">
                  <p className="text-xs">Henüz personel atanmadı</p>
                </div>
              )}

            {/* Hizmet Noktaları Bölümü */}
            {servicePoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">
                    Hizmet Noktaları
                  </span>
                  <Badge variant="secondary" className="text-xs bg-slate-600">
                    {servicePoints.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {servicePoints.map((sp) => {
                    const isSelected = selectedServicePointId === sp.id;
                    const allowedRolesList = sp.allowedRoles || [];

                    return (
                      <div
                        key={sp.id}
                        className={cn(
                          "rounded-lg p-2.5 border cursor-pointer transition-all",
                          isSelected
                            ? "bg-cyan-600/20 border-cyan-500/50 ring-1 ring-cyan-500/30"
                            : "bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50"
                        )}
                        onClick={() => handleServicePointClick(sp.id)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: sp.color }}
                            />
                            <span className="text-sm font-medium text-white">
                              {sp.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Badge className="bg-cyan-600 text-xs">
                              Seçili
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                          <span>
                            {sp.staffAssignments?.length || 0}/
                            {sp.requiredStaffCount} personel
                          </span>
                          <span className="capitalize">
                            {sp.pointType.replace("_", " ")}
                          </span>
                        </div>

                        {/* Personel Ata Butonları - Seçili olduğunda göster */}
                        {isSelected && allowedRolesList.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2 pt-2 border-t border-slate-600/50">
                            {allowedRolesList.map((role) => {
                              const roleInfo = SERVICE_POINT_ROLES.find(
                                (r) => r.value === role
                              );
                              return (
                                <Button
                                  key={role}
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs border-slate-600 hover:bg-slate-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenServicePointStaffModal(role);
                                  }}
                                >
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  {roleInfo?.label || role}
                                </Button>
                              );
                            })}
                          </div>
                        )}

                        {/* Atanmış Personeller */}
                        {sp.staffAssignments &&
                          sp.staffAssignments.length > 0 && (
                            <div className="space-y-1">
                              {sp.staffAssignments.map((sa) => (
                                <div
                                  key={sa.id}
                                  className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{
                                        backgroundColor:
                                          SERVICE_POINT_ROLES.find(
                                            (r) => r.value === sa.role
                                          )?.color || "#6b7280",
                                      }}
                                    />
                                    <span className="text-slate-300">
                                      {sa.staff?.fullName ||
                                        getStaffName(sa.staffId)}
                                    </span>
                                    <span className="text-slate-500">
                                      {SERVICE_POINT_ROLES.find(
                                        (r) => r.value === sa.role
                                      )?.label || sa.role}
                                    </span>
                                  </div>
                                  {onRemoveStaffFromServicePoint && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 text-slate-400 hover:text-red-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveStaffFromServicePoint(
                                          sp.id,
                                          sa.id
                                        );
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-3 border-t border-slate-700 bg-slate-800/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Toplam:{" "}
                {tableGroups.reduce(
                  (sum, g) => sum + (g.staffAssignments?.length || 0),
                  0
                )}{" "}
                atama
              </span>
              {tableGroups.some(
                (g) => !g.staffAssignments || g.staffAssignments.length === 0
              ) && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Eksik atama var
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right - Canvas */}
        <div className="flex-1 flex flex-col">
          {/* Canvas */}
          <div className="flex-1 relative">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="h-full">
                  <CanvasRenderer
                    ref={canvasRef}
                    tables={tables}
                    tableGroups={tableGroups}
                    teams={teams}
                    stageElements={stageElements}
                    servicePoints={servicePoints}
                    selectedTableIds={selectedTableIds}
                    selectedServicePointId={selectedServicePointId}
                    zoom={zoom}
                    offset={offset}
                    activeTool={activeTool}
                    isLassoSelecting={isLassoSelecting}
                    lassoStart={lassoStart}
                    lassoEnd={lassoEnd}
                    onTableClick={handleTableClickWithGroup}
                    onServicePointClick={(spId, e) => {
                      e.stopPropagation();
                      handleServicePointClick(spId);
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
                    className="h-full"
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 bg-slate-800 border-slate-700">
                {/* Grup seçiliyse - Grup personel ekleme */}
                {selectedGroupId && getTeamForGroup(selectedGroupId) ? (
                  <>
                    <div className="px-2 py-1.5 text-xs text-slate-400 border-b border-slate-700">
                      {selectedGroup?.name} - Personel Ekle
                    </div>
                    {STAFF_ROLES.map((role) => (
                      <ContextMenuItem
                        key={role.value}
                        onClick={() => handleOpenStaffModal(role.value)}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.label} Ekle
                      </ContextMenuItem>
                    ))}
                  </>
                ) : selectedGroupId ? (
                  <div className="px-2 py-3 text-center text-slate-400 text-sm">
                    <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                    Bu grup henüz bir takıma atanmamış
                  </div>
                ) : selectedServicePointId && selectedServicePoint ? (
                  /* Hizmet noktası seçiliyse - Hizmet noktası personel ekleme */
                  <>
                    <div className="px-2 py-1.5 text-xs text-slate-400 border-b border-slate-700 flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-cyan-400" />
                      {selectedServicePoint.name} - Personel Ekle
                    </div>
                    {(selectedServicePoint.allowedRoles || []).length > 0 ? (
                      (selectedServicePoint.allowedRoles || []).map((role) => {
                        const roleInfo = SERVICE_POINT_ROLES.find(
                          (r) => r.value === role
                        );
                        return (
                          <ContextMenuItem
                            key={role}
                            onClick={() =>
                              handleOpenServicePointStaffModal(role)
                            }
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{
                                backgroundColor: roleInfo?.color || "#6b7280",
                              }}
                            />
                            {roleInfo?.label || role} Ekle
                          </ContextMenuItem>
                        );
                      })
                    ) : (
                      <div className="px-2 py-3 text-center text-slate-400 text-sm">
                        <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                        Bu hizmet noktasına görev tanımlanmamış
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-2 py-3 text-center text-slate-400 text-sm">
                    Önce bir grup veya hizmet noktası seçin
                  </div>
                )}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

        {/* Staff Selection Modal */}
        <Dialog open={showStaffModal} onOpenChange={setShowStaffModal}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                {selectedRole && getRoleLabel(selectedRole)} Seç -{" "}
                {assignmentMode === "group"
                  ? selectedGroup?.name
                  : selectedServicePoint?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {Object.entries(staffByPosition)
                // Hizmet noktası modunda "Ekstra Personel" grubunu gizle
                .filter(([position]) =>
                  assignmentMode === "servicePoint"
                    ? position !== "Ekstra Personel"
                    : true
                )
                .map(([position, staffList]) => (
                  <StaffAccordionGroup
                    key={position}
                    position={position}
                    staffList={staffList}
                    selectedRole={selectedRole}
                    selectedStaffItems={selectedStaffItems}
                    onToggleStaff={handleToggleStaff}
                  />
                ))}

              {/* Ekstra Personel Ekle Butonu - Sadece grup modunda göster */}
              {assignmentMode === "group" && (
                <div className="pt-3 border-t border-slate-700">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500"
                    onClick={() => setShowExtraStaffModal(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Ekstra Personel Ekle
                  </Button>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    Mevcut personel yetersizse dışarıdan ekstra personel
                    ekleyebilirsiniz
                  </p>
                </div>
              )}

              {/* Hizmet noktası modunda bilgi mesajı */}
              {assignmentMode === "servicePoint" && (
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-amber-400/70 text-center">
                    ⚠️ Ekstra personel hizmet noktalarına atanamaz
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-slate-400">
                  {selectedStaffItems.length} personel seçildi
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowStaffModal(false)}
                    className="border-slate-600"
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleConfirmStaffSelection}
                    disabled={selectedStaffItems.length === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Devam
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shift Time Modal - Her satırda Select */}
        <Dialog open={showShiftModal} onOpenChange={setShowShiftModal}>
          <DialogContent
            className="bg-slate-800 border-slate-700 max-h-[85vh] overflow-hidden flex flex-col"
            style={{ maxWidth: "1100px", width: "95vw" }}
          >
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Vardiya Ataması - {selectedGroup?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 flex-1 overflow-hidden flex flex-col">
              {/* Personel Tablosu */}
              <div className="flex-1 overflow-y-auto border border-slate-700 rounded-lg">
                <table className="w-full">
                  <thead className="bg-slate-700/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">
                        Personel
                      </th>
                      <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 w-28">
                        Görev
                      </th>
                      <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 w-48">
                        Vardiya
                      </th>
                      <th className="text-center text-xs font-medium text-slate-400 px-4 py-3 w-28">
                        Başlangıç
                      </th>
                      <th className="text-center text-xs font-medium text-slate-400 px-4 py-3 w-28">
                        Bitiş
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {selectedStaffItems.map((item) => {
                      // Önce allStaff'ta ara, yoksa extraStaffList'te ara
                      let staff: Staff | undefined = allStaff.find(
                        (s) => s.id === item.staffId
                      );

                      // extraStaffList'te bulunduysa Staff formatına dönüştür
                      if (!staff) {
                        const extraStaff = extraStaffList.find(
                          (s) => s.id === item.staffId
                        );
                        if (extraStaff) {
                          staff = {
                            id: extraStaff.id,
                            fullName: extraStaff.fullName,
                            email: "",
                            phone: "",
                            color: extraStaff.color || DEFAULT_COLORS[0],
                            position: extraStaff.position || "Ekstra",
                            workLocation:
                              extraStaff.workLocation || "Ekstra Personel",
                            department: "Ekstra",
                            avatar: undefined,
                            isActive: extraStaff.isActive ?? true,
                          };
                        }
                      }
                      if (!staff) return null;

                      const currentShift = staffShifts[item.staffId];
                      // Vardiya yoksa veya custom seçiliyse isCustom true olsun
                      const isCustom =
                        !hasEventShifts || currentShift?.shiftId === "custom";

                      return (
                        <tr
                          key={`${item.staffId}-${item.role}`}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          {/* Personel */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <StaffAvatar staff={staff} size="md" />
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {staff.fullName}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {staff.position}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Görev */}
                          <td className="px-4 py-3">
                            <Badge
                              className="text-xs"
                              style={{
                                backgroundColor: `${getRoleColor(item.role)}20`,
                                color: getRoleColor(item.role),
                              }}
                            >
                              {getRoleLabel(item.role)}
                            </Badge>
                          </td>

                          {/* Vardiya Select */}
                          <td className="px-4 py-3">
                            {hasEventShifts ? (
                              <Select
                                value={currentShift?.shiftId || "custom"}
                                onValueChange={(value) =>
                                  handleSelectShift(item.staffId, value)
                                }
                              >
                                <SelectTrigger className="bg-slate-700 border-slate-600 h-9 text-sm">
                                  <SelectValue placeholder="Vardiya seçin..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                  {eventShifts
                                    .filter((s) => s.isActive)
                                    .map((shift) => (
                                      <SelectItem
                                        key={shift.id}
                                        value={shift.id}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2 h-2 rounded-full"
                                            style={{
                                              backgroundColor: shift.color,
                                            }}
                                          />
                                          {shift.startTime} - {shift.endTime}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  <SelectItem value="custom">
                                    <div className="flex items-center gap-2 text-amber-400">
                                      <Clock className="w-3 h-3" />
                                      Özel Saat Gir
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-2 text-amber-400 text-sm px-3 py-2 bg-amber-500/10 rounded border border-amber-500/30">
                                <Clock className="w-4 h-4" />
                                Manuel Giriş
                              </div>
                            )}
                          </td>

                          {/* Başlangıç Saati */}
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={currentShift?.shiftStart || "18:00"}
                              onChange={(e) =>
                                handleUpdateCustomShift(
                                  item.staffId,
                                  "shiftStart",
                                  e.target.value
                                )
                              }
                              className="bg-slate-700 border-slate-600 text-center h-9"
                            />
                          </td>

                          {/* Bitiş Saati */}
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={currentShift?.shiftEnd || "02:00"}
                              onChange={(e) =>
                                handleUpdateCustomShift(
                                  item.staffId,
                                  "shiftEnd",
                                  e.target.value
                                )
                              }
                              className="bg-slate-700 border-slate-600 text-center h-9"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Özet */}
              <div className="flex items-center justify-between text-sm text-slate-400 px-1 mt-3">
                <span>{selectedStaffItems.length} personel atanacak</span>
                {eventShifts.length === 0 && (
                  <span className="text-amber-400 text-xs">
                    ⚠️ Etkinliğe tanımlı vardiya bulunamadı
                  </span>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-slate-700 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowShiftModal(false);
                  setShowStaffModal(true);
                }}
                className="border-slate-600"
              >
                Geri
              </Button>
              <Button
                onClick={handleConfirmShift}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-1" />
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ekstra Personel Modal */}
        <Dialog
          open={showExtraStaffModal}
          onOpenChange={setShowExtraStaffModal}
        >
          <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                Ekstra Personel Ekle
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Ad Soyad */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Ad Soyad <span className="text-red-400">*</span>
                </label>
                <Input
                  placeholder="Personel adı soyadı"
                  value={extraStaffForm.fullName}
                  onChange={(e) =>
                    setExtraStaffForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  className="bg-slate-700 border-slate-600"
                />
              </div>

              {/* Görev */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Görev <span className="text-red-400">*</span>
                </label>
                <Select
                  value={extraStaffForm.position}
                  onValueChange={(value) =>
                    setExtraStaffForm((prev) => ({
                      ...prev,
                      position: value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Görev seçin..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {STAFF_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.label}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                    {SERVICE_POINT_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.label}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bilgi Notu */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-300">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Ekstra personel sadece bu etkinlik için geçerlidir ve ana
                  personel veritabanına kaydedilmez. Görev yeri olarak "Ekstra
                  Personel" görünecektir.
                </p>
              </div>

              {/* Eklenen Ekstra Personeller */}
              {extraStaffList.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Eklenen Ekstra Personeller ({extraStaffList.length})
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {extraStaffList.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-center justify-between bg-slate-700/50 rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: staff.color }}
                          >
                            {staff.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white">
                              {staff.fullName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {staff.position}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-red-400"
                          onClick={() =>
                            setExtraStaffList((prev) =>
                              prev.filter((s) => s.id !== staff.id)
                            )
                          }
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-700 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowExtraStaffModal(false)}
                className="border-slate-600"
              >
                Kapat
              </Button>
              <Button
                onClick={handleAddExtraStaff}
                disabled={
                  !extraStaffForm.fullName.trim() || !extraStaffForm.position
                }
                className="bg-amber-600 hover:bg-amber-700"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Ekle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
