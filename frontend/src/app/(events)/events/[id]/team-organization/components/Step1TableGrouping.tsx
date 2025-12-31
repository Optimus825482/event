"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Wand2,
  FolderPlus,
  Check,
  X,
  AlertCircle,
  Ungroup,
  Users,
  Plus,
  Link,
  Download,
  FileDown,
  Wine,
  MapPin,
  Trash2,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { staffApi } from "@/lib/api";
import {
  TableData,
  TableGroup,
  TeamDefinition,
  DEFAULT_COLORS,
  StageElement,
  ServicePoint,
  SERVICE_POINT_TYPES,
  SERVICE_POINT_ROLES,
  Staff,
  WorkShift,
  GroupStaffAssignment,
} from "../types";
import {
  useCanvasInteraction,
  CanvasTool,
} from "../hooks/useCanvasInteraction";
import { generateAutoGroupName, getNextGroupColor } from "../utils";
import { CanvasRenderer } from "./CanvasRenderer";
import { GroupCard } from "./GroupCard";
import { GroupStaffSelectModal } from "./GroupStaffSelectModal";
import { ServicePointStaffModal } from "./ServicePointStaffModal";
import { cn } from "@/lib/utils";

// Ekip Şablonu tipi (Staff bölümündeki takımlar)
interface TeamTemplate {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  members?: Array<{
    id: string;
    fullName: string;
    position?: string;
    avatar?: string;
  }>;
  leaderId?: string;
  sortOrder: number;
}

// Organizasyon Şablonu tipi (Step5'te kaydedilen şablonlar)
interface OrganizationTemplate {
  id: string;
  name: string;
  description?: string;
  tableGroups: Array<{
    name: string;
    color: string;
    tableIds: string[];
    groupType?: string;
    assignedTeamId?: string;
    assignedTeamName?: string;
  }>;
  staffAssignments: Array<{
    staffId: string;
    staffName?: string;
    tableIds: string[];
    teamId?: string;
    teamName?: string;
  }>;
  createdAt: string;
  isDefault?: boolean;
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
  assignedTables?: string[];
  assignedGroups?: string[];
  workLocation?: string;
}

interface Step1TableGroupingProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  teams?: TeamDefinition[];
  stageElements?: StageElement[];
  servicePoints?: ServicePoint[];
  allStaff?: Staff[];
  extraStaffList?: ExtraStaffItem[];
  workShifts?: WorkShift[];
  eventId?: string;
  onAddGroup: (name: string, tableIds: string[], color?: string) => TableGroup;
  onUpdateGroup: (groupId: string, updates: Partial<TableGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddTablesToGroup: (groupId: string, tableIds: string[]) => void;
  onAddTeam?: (name: string, color?: string) => TeamDefinition;
  onAssignGroupToTeam?: (groupId: string, teamId: string) => void;
  onUnassignGroupFromTeam?: (groupId: string) => void;
  onLoadFromTemplate?: (groups: TableGroup[], teams: TeamDefinition[]) => void;
  onAssignStaffToGroup?: (
    groupId: string,
    assignments: GroupStaffAssignment[]
  ) => void;
  // Ekstra personel güncelleme callback'i
  onUpdateExtraStaff?: (updatedExtraStaff: ExtraStaffItem[]) => void;
  // Service Points callbacks
  onAddServicePoint?: (data: {
    name: string;
    pointType: string;
    requiredStaffCount: number;
    allowedRoles: string[];
    color: string;
    description?: string;
  }) => void;
  onUpdateServicePoint?: (id: string, data: Partial<ServicePoint>) => void;
  onDeleteServicePoint?: (id: string) => void;
  onSaveServicePointStaffAssignments?: (
    servicePointId: string,
    assignments: Array<{
      id?: string;
      staffId: string;
      role: string;
      shiftId?: string;
      shiftStart: string;
      shiftEnd: string;
    }>
  ) => Promise<boolean>;
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
  // View mode (2D/3D) - controlled by parent
  viewMode?: "2d" | "3d";
}

export function Step1TableGrouping({
  tables,
  tableGroups,
  teams = [],
  stageElements = [],
  servicePoints = [],
  allStaff = [],
  extraStaffList = [],
  workShifts = [],
  eventId,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddTablesToGroup,
  onAddTeam,
  onAssignGroupToTeam,
  onUnassignGroupFromTeam,
  onLoadFromTemplate,
  onAssignStaffToGroup,
  onUpdateExtraStaff,
  onAddServicePoint,
  onUpdateServicePoint,
  onDeleteServicePoint,
  onSaveServicePointStaffAssignments,
  onCanvasStateChange,
  viewMode = "2d",
}: Step1TableGroupingProps) {
  // Canvas interaction hook
  const canvasRef = useRef<HTMLDivElement>(null);
  const groupListRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
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
  } = useCanvasInteraction({
    tables,
    onSelectionChange: (ids) => {
      // Selection changed callback
    },
  });

  // Local state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showServicePointModal, setShowServicePointModal] = useState(false);
  const [showStaffSelectModal, setShowStaffSelectModal] = useState(false);
  const [showServicePointStaffModal, setShowServicePointStaffModal] =
    useState(false);
  const [selectedServicePointForStaff, setSelectedServicePointForStaff] =
    useState<ServicePoint | null>(null);
  const [newlyCreatedGroup, setNewlyCreatedGroup] = useState<TableGroup | null>(
    null
  );
  const [editingServicePoint, setEditingServicePoint] =
    useState<ServicePoint | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(DEFAULT_COLORS[0]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(DEFAULT_COLORS[0]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Service Point state
  const [spName, setSpName] = useState("");
  const [spPointType, setSpPointType] = useState("bar");
  const [spRequiredStaff, setSpRequiredStaff] = useState(1);
  const [spAllowedRoles, setSpAllowedRoles] = useState<string[]>([
    "barman",
    "garson",
  ]);
  const [spColor, setSpColor] = useState("#06b6d4");
  const [spDescription, setSpDescription] = useState("");
  const [selectedServicePointId, setSelectedServicePointId] = useState<
    string | null
  >(null);

  const [contextMenuGroupId, setContextMenuGroupId] = useState<string | null>(
    null
  );
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Şablon yükleme state'leri
  const [organizationTemplates, setOrganizationTemplates] = useState<
    OrganizationTemplate[]
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateLoadResult, setTemplateLoadResult] = useState<{
    loadedGroups: number;
    loadedPersonnel: number;
    totalTables: number;
  } | null>(null);

  // Stable refs for callbacks to avoid infinite loop
  const handlersRef = useRef({
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    onToolChange: setActiveTool,
    onSelectAll: handleSelectAll,
  });

  // Update refs when handlers change
  handlersRef.current = {
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    onToolChange: setActiveTool,
    onSelectAll: handleSelectAll,
  };

  // Expose canvas state to parent for toolbar - only when zoom/activeTool changes
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

  // Table ID -> Table label map (UUID -> masa numarası)
  const idToLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => map.set(t.id, t.label));
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
    console.log("🗺️ tableToGroupMap oluşturuldu:", map.size, "masa gruplanmış");
    return map;
  }, [tableGroups, labelToIdMap]);

  // Get table group helper for click handling
  const getTableGroup = useCallback(
    (tableId: string) => tableToGroupMap.get(tableId),
    [tableToGroupMap]
  );

  // Ungrouped tables
  const ungroupedTables = useMemo(() => {
    return tables.filter((t) => !tableToGroupMap.has(t.id));
  }, [tables, tableToGroupMap]);

  // Handle table click with group selection (Ctrl+click for multi-select)
  // Normal click on grouped table: open staff modal
  // Ctrl+click: multi-select groups
  const handleTableClickWithGroup = useCallback(
    (tableId: string, e: React.MouseEvent) => {
      const group = getTableGroup(tableId);

      // Eğer Ctrl/Meta tuşu basılı değilse ve masa bir gruba aitse
      // Personel atama modalını aç
      if (group && !e.ctrlKey && !e.metaKey) {
        setNewlyCreatedGroup(group);
        setShowStaffSelectModal(true);
        setSelectedGroupIds([group.id]);

        // Scroll to group in left panel
        setTimeout(() => {
          const groupElement = groupRefs.current.get(group.id);
          if (groupElement && groupListRef.current) {
            groupElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 50);
        return;
      }

      // Ctrl+click veya grupsuz masa için normal davranış
      handleTableClick(tableId, e, getTableGroup);

      if (group) {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+click: toggle group in selection
          setSelectedGroupIds((prev) =>
            prev.includes(group.id)
              ? prev.filter((id) => id !== group.id)
              : [...prev, group.id]
          );
        }

        // Scroll to group in left panel
        setTimeout(() => {
          const groupElement = groupRefs.current.get(group.id);
          if (groupElement && groupListRef.current) {
            groupElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 50);
      } else {
        if (!e.ctrlKey && !e.metaKey) {
          setSelectedGroupIds([]);
        }
      }
    },
    [handleTableClick, getTableGroup]
  );

  // Create new group from selection
  const handleCreateGroup = useCallback(() => {
    if (selectedTableIds.length === 0) return;

    const suggestedName = generateAutoGroupName(
      selectedTableIds,
      tables,
      tableGroups
    );
    const suggestedColor = getNextGroupColor(tableGroups);

    setNewGroupName(suggestedName);
    setNewGroupColor(suggestedColor);
    setShowGroupModal(true);
  }, [selectedTableIds, tables, tableGroups]);

  // Confirm group creation - then open staff select modal
  const handleConfirmCreateGroup = useCallback(() => {
    if (!newGroupName.trim() || selectedTableIds.length === 0) return;

    const newGroup = onAddGroup(
      newGroupName.trim(),
      selectedTableIds,
      newGroupColor
    );
    setShowGroupModal(false);
    setNewGroupName("");

    // Yeni oluşturulan grubu kaydet ve personel modalını aç
    setNewlyCreatedGroup(newGroup);
    setShowStaffSelectModal(true);

    handleClearSelection();
  }, [
    newGroupName,
    selectedTableIds,
    newGroupColor,
    onAddGroup,
    handleClearSelection,
  ]);

  // Personel seçimi kaydet
  const handleSaveStaffAssignments = useCallback(
    (
      assignments: GroupStaffAssignment[],
      extraStaff: Array<{
        fullName: string;
        role: string;
        shiftStart: string;
        shiftEnd: string;
      }>
    ) => {
      if (!newlyCreatedGroup) return;

      // Grubun mevcut personel atamalarını güncelle (yeni atamalarla değiştir)
      if (onAssignStaffToGroup) {
        onUpdateGroup(newlyCreatedGroup.id, { staffAssignments: assignments });
      }

      // Ekstra personellerin assignedGroups alanını güncelle
      // Modal'dan seçilen ekstra personelleri bul ve assignedGroups'a bu grubu ekle
      if (onUpdateExtraStaff && extraStaffList.length > 0) {
        const extraStaffIdsInAssignments = assignments
          .filter((a) => a.isExtra && a.staffId)
          .map((a) => a.staffId);

        if (extraStaffIdsInAssignments.length > 0) {
          const updatedExtraStaff = extraStaffList.map((es) => {
            // Bu ekstra personel bu gruba atandı mı?
            if (extraStaffIdsInAssignments.includes(es.id)) {
              // assignedGroups'a bu grubu ekle (yoksa oluştur)
              const currentGroups = (es as any).assignedGroups || [];
              const newGroups = currentGroups.includes(newlyCreatedGroup.id)
                ? currentGroups
                : [...currentGroups, newlyCreatedGroup.id];

              console.log(
                "✅ Ekstra personel gruba atandı:",
                es.fullName,
                "->",
                newlyCreatedGroup.name,
                "assignedGroups:",
                newGroups
              );

              return {
                ...es,
                assignedGroups: newGroups,
              };
            }
            return es;
          });

          onUpdateExtraStaff(updatedExtraStaff);
        }
      }

      setShowStaffSelectModal(false);
      setNewlyCreatedGroup(null);
    },
    [
      newlyCreatedGroup,
      onAssignStaffToGroup,
      onUpdateGroup,
      onUpdateExtraStaff,
      extraStaffList,
    ]
  );

  // Personel modalını kapat (atama yapmadan)
  const handleCloseStaffModal = useCallback(() => {
    setShowStaffSelectModal(false);
    setNewlyCreatedGroup(null);
  }, []);

  // Add selected tables to existing group
  const handleAddToGroup = useCallback(
    (groupId: string) => {
      if (selectedTableIds.length === 0) return;
      onAddTablesToGroup(groupId, selectedTableIds);
      handleClearSelection();
    },
    [selectedTableIds, onAddTablesToGroup, handleClearSelection]
  );

  // Auto-group by proximity (simple algorithm)
  const handleAutoGroup = useCallback(() => {
    if (tables.length === 0) return;

    // Simple grid-based grouping
    const gridSize = 150; // pixels
    const groups = new Map<string, string[]>();

    tables.forEach((table) => {
      const gridX = Math.floor(table.x / gridSize);
      const gridY = Math.floor(table.y / gridSize);
      const key = `${gridX}-${gridY}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(table.id);
    });

    // Create groups for cells with multiple tables
    let groupIndex = tableGroups.length + 1;
    groups.forEach((tableIds, key) => {
      if (tableIds.length >= 2) {
        // Only create groups with 2+ tables
        const name = `Grup-${groupIndex}`;
        const color = DEFAULT_COLORS[(groupIndex - 1) % DEFAULT_COLORS.length];
        onAddGroup(name, tableIds, color);
        groupIndex++;
      }
    });
  }, [tables, tableGroups.length, onAddGroup]);

  // ==================== ŞABLON YÜKLEME FONKSİYONLARI ====================

  // Organizasyon şablonlarını API'den yükle
  const loadOrganizationTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const response = await staffApi.getOrganizationTemplates();
      setOrganizationTemplates(response.data || []);
    } catch (error) {
      console.error("Şablonlar yüklenemedi:", error);
      setOrganizationTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // Şablon modal'ını aç
  const handleOpenTemplateModal = useCallback(() => {
    loadOrganizationTemplates();
    setSelectedTemplateId(null);
    setTemplateLoadResult(null);
    setShowTemplateModal(true);
  }, [loadOrganizationTemplates]);

  // Şablon seçimini toggle et
  const toggleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplateId((prev) => (prev === templateId ? null : templateId));
  }, []);

  // Seçili şablonu uygula - Şablondaki gruplar ve personeller yüklenir
  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplateId || !onLoadFromTemplate || !eventId) return;

    const selectedTemplate = organizationTemplates.find(
      (t) => t.id === selectedTemplateId
    );
    if (!selectedTemplate) return;

    console.log("🎯 handleApplyTemplate - Seçilen şablon:", {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      groupsCount: selectedTemplate.tableGroups?.length || 0,
      staffCount: selectedTemplate.staffAssignments?.length || 0,
    });

    try {
      // Backend'deki applyOrganizationTemplate endpoint'ini çağır
      // Bu endpoint şablonu etkinliğe uygular ve gerekli takımları oluşturur
      const response = await staffApi.applyOrganizationTemplate(
        selectedTemplateId,
        eventId
      );

      if (response.data?.success) {
        // Başarılı - sayfayı yenile veya verileri tekrar yükle
        setTemplateLoadResult({
          loadedGroups: selectedTemplate.tableGroups?.length || 0,
          loadedPersonnel: selectedTemplate.staffAssignments?.length || 0,
          totalTables: tables.length,
        });

        // Modal'ı kapat ve sayfayı yenile
        setTimeout(() => {
          setShowTemplateModal(false);
          // Sayfayı yenile - verilerin güncellenmesi için
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Şablon uygulanamadı:", error);
      alert("Şablon uygulanırken bir hata oluştu");
    }
  }, [
    selectedTemplateId,
    organizationTemplates,
    eventId,
    tables,
    onLoadFromTemplate,
  ]);

  // Helper: Convert table labels (masa numaraları) to table IDs (UUIDs)
  const getTableIdsByLabels = useCallback(
    (labels: string[]): string[] => {
      const result: string[] = [];
      labels.forEach((label) => {
        const tableId = labelToIdMap.get(label);
        if (tableId) {
          result.push(tableId);
        }
      });
      console.log(
        "🔍 getTableIdsByLabels:",
        labels.length,
        "label ->",
        result.length,
        "UUID"
      );
      return result;
    },
    [labelToIdMap]
  );

  // Select group tables (with Ctrl support for multi-select)
  const handleGroupClick = useCallback(
    (groupId: string, e?: React.MouseEvent) => {
      const group = tableGroups.find((g) => g.id === groupId);
      if (group) {
        // group.tableIds masa numaralarını içeriyor (örn: ["1", "2", "3"])
        // Canvas table.id (UUID) bekliyor, bu yüzden dönüştürüyoruz
        const tableUUIDs = getTableIdsByLabels(group.tableIds);

        if (e?.ctrlKey || e?.metaKey) {
          // Ctrl+click: toggle group and add/remove its tables
          setSelectedGroupIds((prev) => {
            if (prev.includes(groupId)) {
              // Remove group's tables from selection
              setSelectedTableIds((prevTables) =>
                prevTables.filter((id) => !tableUUIDs.includes(id))
              );
              return prev.filter((id) => id !== groupId);
            } else {
              // Add group's tables to selection
              setSelectedTableIds((prevTables) => [
                ...new Set([...prevTables, ...tableUUIDs]),
              ]);
              return [...prev, groupId];
            }
          });
        } else {
          // Normal click: select only this group
          setSelectedTableIds(tableUUIDs);
          setSelectedGroupIds([groupId]);
        }
      }
    },
    [tableGroups, setSelectedTableIds, getTableIdsByLabels]
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
      } else if (e.key === "Delete" && selectedGroupIds.length > 0) {
        selectedGroupIds.forEach((id) => onDeleteGroup(id));
        setSelectedGroupIds([]);
      }
    },
    [handleClearSelection, handleSelectAll, selectedGroupIds, onDeleteGroup]
  );

  // Delete all groups
  const handleDeleteAllGroups = useCallback(() => {
    tableGroups.forEach((group) => {
      onDeleteGroup(group.id);
    });
    setSelectedGroupIds([]);
    handleClearSelection();
  }, [tableGroups, onDeleteGroup, handleClearSelection]);

  // Context menu for group - right click
  const handleGroupContextMenu = useCallback(
    (e: React.MouseEvent, groupId: string) => {
      e.preventDefault();
      setContextMenuGroupId(groupId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // Assign group to team
  const handleAssignToTeam = useCallback(
    (teamId: string) => {
      if (contextMenuGroupId && onAssignGroupToTeam) {
        onAssignGroupToTeam(contextMenuGroupId, teamId);
      }
      setContextMenuGroupId(null);
      setContextMenuPosition(null);
    },
    [contextMenuGroupId, onAssignGroupToTeam]
  );

  // Unassign group from team
  const handleUnassignFromTeam = useCallback(() => {
    if (contextMenuGroupId && onUnassignGroupFromTeam) {
      onUnassignGroupFromTeam(contextMenuGroupId);
    }
    setContextMenuGroupId(null);
    setContextMenuPosition(null);
  }, [contextMenuGroupId, onUnassignGroupFromTeam]);

  // Open new team modal
  const handleOpenNewTeamModal = useCallback(() => {
    const suggestedColor = DEFAULT_COLORS[teams.length % DEFAULT_COLORS.length];
    setNewTeamName(`Takım ${teams.length + 1}`);
    setNewTeamColor(suggestedColor);
    setShowTeamModal(true);
  }, [teams.length]);

  // Create new team and assign group
  const handleCreateTeamAndAssign = useCallback(() => {
    if (
      !newTeamName.trim() ||
      !onAddTeam ||
      !onAssignGroupToTeam ||
      !contextMenuGroupId
    )
      return;

    const newTeam = onAddTeam(newTeamName.trim(), newTeamColor);
    onAssignGroupToTeam(contextMenuGroupId, newTeam.id);

    setShowTeamModal(false);
    setNewTeamName("");
    setContextMenuGroupId(null);
    setContextMenuPosition(null);
  }, [
    newTeamName,
    newTeamColor,
    onAddTeam,
    onAssignGroupToTeam,
    contextMenuGroupId,
  ]);

  // Get assigned team for a group
  const getAssignedTeam = useCallback(
    (groupId: string) => {
      const group = tableGroups.find((g) => g.id === groupId);
      if (!group?.assignedTeamId) return null;
      return teams.find((t) => t.id === group.assignedTeamId);
    },
    [tableGroups, teams]
  );

  // ==================== SERVICE POINT HANDLERS ====================

  // Open service point modal for create
  const handleOpenServicePointModal = useCallback(() => {
    setEditingServicePoint(null);
    setSpName("");
    setSpPointType("bar");
    setSpRequiredStaff(1);
    setSpAllowedRoles(["barman", "garson"]);
    setSpColor("#06b6d4");
    setSpDescription("");
    setShowServicePointModal(true);
  }, []);

  // Open service point modal for edit
  const handleEditServicePoint = useCallback((sp: ServicePoint) => {
    setEditingServicePoint(sp);
    setSpName(sp.name);
    setSpPointType(sp.pointType);
    setSpRequiredStaff(sp.requiredStaffCount);
    setSpAllowedRoles(sp.allowedRoles);
    setSpColor(sp.color);
    setSpDescription(sp.description || "");
    setShowServicePointModal(true);
  }, []);

  // Toggle role selection
  const handleToggleSpRole = useCallback((role: string) => {
    setSpAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }, []);

  // Save service point - kaydettikten sonra personel atama modalı aç
  const handleSaveServicePoint = useCallback(() => {
    if (!spName.trim() || spAllowedRoles.length === 0) return;

    if (editingServicePoint && onUpdateServicePoint) {
      onUpdateServicePoint(editingServicePoint.id, {
        name: spName.trim(),
        pointType: spPointType,
        requiredStaffCount: spRequiredStaff,
        allowedRoles: spAllowedRoles,
        color: spColor,
        description: spDescription.trim() || undefined,
      });
      setShowServicePointModal(false);
      setEditingServicePoint(null);
    } else if (onAddServicePoint) {
      const trimmedName = spName.trim();

      onAddServicePoint({
        name: trimmedName,
        pointType: spPointType,
        requiredStaffCount: spRequiredStaff,
        allowedRoles: spAllowedRoles,
        color: spColor,
        description: spDescription.trim() || undefined,
      });

      // Hizmet noktası kaydedildi - kullanıcı canvas'ta tıklayarak personel atayabilir

      setShowServicePointModal(false);
      setEditingServicePoint(null);
    }
  }, [
    spName,
    spPointType,
    spRequiredStaff,
    spAllowedRoles,
    spColor,
    spDescription,
    editingServicePoint,
    onAddServicePoint,
    onUpdateServicePoint,
  ]);

  // Delete service point
  const handleDeleteServicePoint = useCallback(
    (id: string) => {
      if (onDeleteServicePoint) {
        onDeleteServicePoint(id);
      }
    },
    [onDeleteServicePoint]
  );

  // Service point click on canvas - sadece seçim yap
  const handleServicePointClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      setSelectedServicePointId(id);
    },
    []
  );

  // Service point double click - personel atama modalını aç
  const handleServicePointDoubleClick = useCallback(
    (id: string) => {
      const sp = servicePoints.find((s) => s.id === id);
      if (sp) {
        setSelectedServicePointForStaff(sp);
        setShowServicePointStaffModal(true);
      }
    },
    [servicePoints]
  );

  return (
    <TooltipProvider>
      <div
        className="flex gap-4 h-[660px]"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Left Panel - Groups */}
        <div className="w-72 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col flex-shrink-0 h-full">
          {/* Header */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">
                Masa Grupları
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenTemplateModal}
                  className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                  title="Şablondan Yükle"
                >
                  <FileDown className="w-3 h-3 mr-1" />
                  Şablon
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleAutoGroup}
                  className="h-7 text-xs text-slate-400 hover:text-white"
                  title="Otomatik Grupla"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  Otomatik
                </Button>
              </div>
            </div>
            {tableGroups.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteAllGroups}
                className="w-full h-7 text-xs border-red-600/50 text-red-400 hover:bg-red-600/20 hover:text-red-300"
              >
                <Ungroup className="w-3 h-3 mr-1" />
                Tüm Grupları Dağıt ({tableGroups.length})
              </Button>
            )}
          </div>

          {/* Groups List */}
          <div
            ref={groupListRef}
            className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2"
          >
            {tableGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FolderPlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Henüz grup yok</p>
                <p className="text-xs mt-1">
                  Canvas'ta masaları seçip grup oluşturun
                </p>
              </div>
            ) : (
              tableGroups.map((group) => {
                const assignedTeam = getAssignedTeam(group.id);
                return (
                  <ContextMenu key={group.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        ref={(el) => {
                          if (el) groupRefs.current.set(group.id, el);
                          else groupRefs.current.delete(group.id);
                        }}
                        className={cn(
                          "transition-all duration-300",
                          selectedGroupIds.includes(group.id) &&
                            "scale-[1.02] shadow-lg shadow-purple-500/20"
                        )}
                      >
                        <GroupCard
                          group={group}
                          tableCount={group.tableIds.length}
                          isSelected={selectedGroupIds.includes(group.id)}
                          onEdit={(id, updates) => onUpdateGroup(id, updates)}
                          onDelete={onDeleteGroup}
                          onClick={handleGroupClick}
                        />
                        {/* Assigned Team Badge */}
                        {assignedTeam && (
                          <div
                            className="mt-1 ml-1 flex items-center gap-1 text-xs"
                            style={{ color: assignedTeam.color }}
                          >
                            <Users className="w-3 h-3" />
                            <span>{assignedTeam.name}</span>
                          </div>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48 bg-slate-800 border-slate-700">
                      {/* Takıma Ekle */}
                      {onAssignGroupToTeam && (
                        <ContextMenuSub>
                          <ContextMenuSubTrigger className="text-slate-200 focus:bg-slate-700">
                            <Link className="w-4 h-4 mr-2" />
                            Takıma Ekle
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="bg-slate-800 border-slate-700">
                            {teams.length > 0 ? (
                              <>
                                {teams.map((team) => (
                                  <ContextMenuItem
                                    key={team.id}
                                    onClick={() => {
                                      if (onAssignGroupToTeam) {
                                        onAssignGroupToTeam(group.id, team.id);
                                      }
                                    }}
                                    className="text-slate-200 focus:bg-slate-700"
                                  >
                                    <div
                                      className="w-3 h-3 rounded-full mr-2"
                                      style={{ backgroundColor: team.color }}
                                    />
                                    {team.name}
                                    {group.assignedTeamId === team.id && (
                                      <Check className="w-4 h-4 ml-auto text-emerald-400" />
                                    )}
                                  </ContextMenuItem>
                                ))}
                                <ContextMenuSeparator className="bg-slate-700" />
                              </>
                            ) : null}
                            {onAddTeam && (
                              <ContextMenuItem
                                onClick={() => {
                                  setContextMenuGroupId(group.id);
                                  handleOpenNewTeamModal();
                                }}
                                className="text-emerald-400 focus:bg-slate-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Yeni Takım Oluştur
                              </ContextMenuItem>
                            )}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                      )}

                      {/* Takımdan Çıkar */}
                      {group.assignedTeamId && onUnassignGroupFromTeam && (
                        <ContextMenuItem
                          onClick={() => onUnassignGroupFromTeam(group.id)}
                          className="text-amber-400 focus:bg-slate-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Takımdan Çıkar
                        </ContextMenuItem>
                      )}

                      <ContextMenuSeparator className="bg-slate-700" />

                      {/* Grubu Dağıt */}
                      <ContextMenuItem
                        onClick={() => onDeleteGroup(group.id)}
                        className="text-red-400 focus:bg-slate-700"
                      >
                        <Ungroup className="w-4 h-4 mr-2" />
                        Grubu Dağıt
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })
            )}

            {/* Service Points Section */}
            {(servicePoints.length > 0 || onAddServicePoint) && (
              <div className="mt-4 pt-3 border-t border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-cyan-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Hizmet Noktaları
                  </h4>
                  {onAddServicePoint && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleOpenServicePointModal}
                      className="h-6 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/20 px-2"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Ekle
                    </Button>
                  )}
                </div>
                {servicePoints.length === 0 ? (
                  <div className="text-center py-3 text-slate-500">
                    <Wine className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-xs">Henüz hizmet noktası yok</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {servicePoints.map((sp) => {
                      const typeConfig = SERVICE_POINT_TYPES.find(
                        (t) => t.value === sp.pointType
                      );
                      const assignedCount =
                        sp.staffAssignments?.length ||
                        sp.assignedStaffCount ||
                        0;
                      return (
                        <div
                          key={sp.id}
                          onClick={() => setSelectedServicePointId(sp.id)}
                          onDoubleClick={() => {
                            // Çift tıklama: personel atama modalını aç
                            setSelectedServicePointForStaff(sp);
                            setShowServicePointStaffModal(true);
                          }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                            "border border-transparent hover:border-slate-600",
                            selectedServicePointId === sp.id
                              ? "bg-cyan-600/20 border-cyan-500"
                              : "bg-slate-700/30 hover:bg-slate-700/50"
                          )}
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${sp.color}30` }}
                          >
                            <Wine
                              className="w-3 h-3"
                              style={{ color: sp.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-medium truncate"
                              style={{ color: sp.color }}
                            >
                              {sp.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {typeConfig?.label} • {assignedCount}/
                              {sp.requiredStaffCount} personel
                            </p>
                          </div>
                          {/* Personel Ata Butonu */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedServicePointForStaff(sp);
                              setShowServicePointStaffModal(true);
                            }}
                            className="h-5 px-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/20"
                            title="Personel Ata"
                          >
                            <Users className="w-3 h-3" />
                          </Button>
                          {onDeleteServicePoint && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteServicePoint(sp.id);
                              }}
                              className="h-5 w-5 p-0 text-slate-500 hover:text-red-400 hover:bg-red-600/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-3 border-t border-slate-700 bg-slate-800/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Toplam: {tables.length} masa
              </span>
              {ungroupedTables.length > 0 && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {ungroupedTables.length} grupsuz
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right - Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Selection Action Bar - Canvas üstünde sabit blok */}
          <div className="h-12 flex items-center justify-center mb-2">
            {selectedTableIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-600 shadow-lg">
                <Badge variant="secondary" className="bg-purple-600 text-white">
                  {selectedTableIds.length} masa seçili
                  {selectedGroupIds.length > 1 &&
                    ` (${selectedGroupIds.length} grup)`}
                </Badge>

                {/* Grup seçiliyse "Grubu Dağıt", değilse "Yeni Grup" */}
                {selectedGroupIds.length > 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      selectedGroupIds.forEach((id) => onDeleteGroup(id));
                      setSelectedGroupIds([]);
                      handleClearSelection();
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Ungroup className="w-4 h-4 mr-1" />
                    {selectedGroupIds.length > 1
                      ? `${selectedGroupIds.length} Grubu Dağıt`
                      : "Grubu Dağıt"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={handleCreateGroup}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <FolderPlus className="w-4 h-4 mr-1" />
                      Yeni Grup
                    </Button>

                    {tableGroups.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400 px-2">
                          veya
                        </span>
                        {tableGroups.slice(0, 3).map((group) => (
                          <Button
                            key={group.id}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 border-slate-600"
                            style={{ borderColor: group.color }}
                            onClick={() => handleAddToGroup(group.id)}
                          >
                            <div
                              className="w-2 h-2 rounded-full mr-1"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="text-xs truncate max-w-[60px]">
                              {group.name}
                            </span>
                          </Button>
                        ))}
                        {tableGroups.length > 3 && (
                          <span className="text-xs text-slate-500">
                            +{tableGroups.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}

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
                Masaları seçmek için tıklayın veya sürükleyin (Ctrl+tık ile
                çoklu seçim)
              </div>
            )}
          </div>

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
                    onServicePointClick={handleServicePointClick}
                    onServicePointDoubleClick={handleServicePointDoubleClick}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasMouseMove={handleCanvasMouseMove}
                    onCanvasMouseUp={handleCanvasMouseUp}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetView={handleResetView}
                    onToolChange={setActiveTool}
                    onSelectAll={handleSelectAll}
                    onCreateGroup={handleCreateGroup}
                    showToolbar={false}
                    showCreateGroupButton={false}
                    showServicePoints={true}
                    show3DToggle={false}
                    viewMode={viewMode}
                    className="h-full"
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48 bg-slate-800 border-slate-700">
                {/* Seçili grup(lar) varsa - Step 1'de sadece Grubu Dağıt göster */}
                {selectedGroupIds.length > 0 && (
                  <>
                    {/* Grubu Dağıt */}
                    <ContextMenuItem
                      onClick={() => {
                        selectedGroupIds.forEach((id) => onDeleteGroup(id));
                        setSelectedGroupIds([]);
                        handleClearSelection();
                      }}
                      className="text-red-400 focus:bg-slate-700"
                    >
                      <Ungroup className="w-4 h-4 mr-2" />
                      {selectedGroupIds.length > 1
                        ? `${selectedGroupIds.length} Grubu Dağıt`
                        : "Grubu Dağıt"}
                    </ContextMenuItem>
                  </>
                )}

                {/* Seçili masalar varsa ama grup değilse */}
                {selectedTableIds.length > 0 &&
                  selectedGroupIds.length === 0 && (
                    <>
                      <ContextMenuItem
                        onClick={handleCreateGroup}
                        className="text-emerald-400 focus:bg-slate-700"
                      >
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Yeni Grup Oluştur
                      </ContextMenuItem>

                      {tableGroups.length > 0 && (
                        <>
                          <ContextMenuSeparator className="bg-slate-700" />
                          <ContextMenuSub>
                            <ContextMenuSubTrigger className="text-slate-200 focus:bg-slate-700">
                              <Plus className="w-4 h-4 mr-2" />
                              Gruba Ekle
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent className="bg-slate-800 border-slate-700">
                              {tableGroups.map((group) => (
                                <ContextMenuItem
                                  key={group.id}
                                  onClick={() => handleAddToGroup(group.id)}
                                  className="text-slate-200 focus:bg-slate-700"
                                >
                                  <div
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  {group.name}
                                </ContextMenuItem>
                              ))}
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                        </>
                      )}
                    </>
                  )}

                {/* Hiçbir şey seçili değilse */}
                {selectedTableIds.length === 0 && (
                  <ContextMenuItem
                    onClick={handleSelectAll}
                    className="text-slate-200 focus:bg-slate-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Tümünü Seç
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

        {/* Create Group Modal */}
        <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                Yeni Grup Oluştur
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">
                  Grup Adı
                </label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Örn: 1-10 Masalar"
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
                        "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                        newGroupColor === color
                          ? "border-white scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewGroupColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-sm text-slate-300">
                  <span className="font-medium text-white">
                    {selectedTableIds.length}
                  </span>{" "}
                  masa bu gruba eklenecek
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowGroupModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleConfirmCreateGroup}
                disabled={!newGroupName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-1" />
                Oluştur
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Team Modal */}
        <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Yeni Takım Oluştur
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
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
                        "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
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

              {contextMenuGroupId && (
                <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3">
                  <p className="text-sm text-blue-300">
                    <span className="font-medium text-white">
                      {
                        tableGroups.find((g) => g.id === contextMenuGroupId)
                          ?.name
                      }
                    </span>{" "}
                    grubu bu takıma atanacak
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTeamModal(false);
                  setContextMenuGroupId(null);
                }}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleCreateTeamAndAssign}
                disabled={!newTeamName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Check className="w-4 h-4 mr-1" />
                Oluştur ve Ata
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Load Modal */}
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <FileDown className="w-5 h-5 text-blue-400" />
                Organizasyon Şablonlarından Yükle
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Daha önce kaydedilmiş organizasyon şablonlarından birini seçin.
                Şablon uygulandığında mevcut gruplar silinecek.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Mevcut gruplar varsa uyarı */}
              {tableGroups.length > 0 && (
                <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3">
                  <p className="text-sm text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Mevcut {tableGroups.length} grup silinecek ve şablondaki
                    gruplar yüklenecek.
                  </p>
                </div>
              )}

              {/* Şablon Listesi */}
              {templatesLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                  Şablonlar yükleniyor...
                </div>
              ) : organizationTemplates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Kayıtlı organizasyon şablonu bulunamadı
                  </p>
                  <p className="text-xs mt-1">
                    Önce Step 5'te "Şablon Olarak Kaydet" ile şablon oluşturun
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {organizationTemplates.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    const groupCount = template.tableGroups?.length || 0;
                    const staffCount = template.staffAssignments?.length || 0;

                    return (
                      <div
                        key={template.id}
                        onClick={() => toggleTemplateSelection(template.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected
                            ? "bg-blue-600/20 border-blue-500"
                            : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                        )}
                      >
                        {/* Radio */}
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-slate-500"
                          )}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>

                        {/* Bilgi */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {template.name}
                            </p>
                            {template.isDefault && (
                              <Badge className="bg-purple-600/20 text-purple-400 text-[10px]">
                                Varsayılan
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {groupCount} grup • {staffCount} personel ataması
                          </p>
                          {template.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {template.description}
                            </p>
                          )}
                        </div>

                        {/* Tarih */}
                        <div className="text-xs text-slate-500 flex-shrink-0">
                          {new Date(template.createdAt).toLocaleDateString(
                            "tr-TR"
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sonuç Bildirimi */}
              {templateLoadResult && (
                <div className="bg-emerald-900/30 border-emerald-600/50 rounded-lg p-3 border">
                  <p className="text-sm flex items-center gap-2 text-emerald-300">
                    <Check className="w-4 h-4" />
                    {templateLoadResult.loadedGroups} grup,{" "}
                    {templateLoadResult.loadedPersonnel} personel ataması
                    yüklendi!
                  </p>
                </div>
              )}

              {/* Bilgi */}
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Mevcut Masalar:</strong>{" "}
                  {tables.length} adet •
                  <strong className="text-slate-300 ml-2">Şablonlar:</strong>{" "}
                  {organizationTemplates.length} adet
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTemplateModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || templatesLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Şablonu Uygula
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Group Staff Select Modal */}
        {newlyCreatedGroup && (
          <GroupStaffSelectModal
            open={showStaffSelectModal}
            onClose={handleCloseStaffModal}
            onSave={handleSaveStaffAssignments}
            onDissolveGroup={() => {
              onDeleteGroup(newlyCreatedGroup.id);
            }}
            onAddTables={(tableIds) => {
              onAddTablesToGroup(newlyCreatedGroup.id, tableIds);
            }}
            onRemoveTable={(tableId) => {
              // Gruptan masa çıkar - grubu güncelle
              const currentGroup = tableGroups.find(
                (g) => g.id === newlyCreatedGroup.id
              );
              if (currentGroup && currentGroup.tableIds.length > 2) {
                const newTableIds = currentGroup.tableIds.filter(
                  (id) => id !== tableId
                );
                onUpdateGroup(newlyCreatedGroup.id, { tableIds: newTableIds });
              }
            }}
            groupId={newlyCreatedGroup.id}
            groupName={newlyCreatedGroup.name}
            groupColor={newlyCreatedGroup.color}
            tableIds={
              tableGroups.find((g) => g.id === newlyCreatedGroup.id)
                ?.tableIds || newlyCreatedGroup.tableIds
            }
            tableLabels={
              // tableGroups.tableIds zaten masa numaralarını içeriyor (örn: ["1", "2", "3"])
              // Direkt kullan, UUID'ye çevirmeye gerek yok
              tableGroups.find((g) => g.id === newlyCreatedGroup.id)
                ?.tableIds || newlyCreatedGroup.tableIds
            }
            availableTables={ungroupedTables.map((t) => ({
              id: t.id,
              label: t.label,
            }))}
            allStaff={allStaff}
            extraStaffList={extraStaffList}
            workShifts={workShifts}
            existingAssignments={
              tableGroups.find((g) => g.id === newlyCreatedGroup.id)
                ?.staffAssignments || newlyCreatedGroup.staffAssignments
            }
          />
        )}

        {/* Service Point Staff Modal - Sadece geçerli servicePoint varsa render et */}
        {showServicePointStaffModal &&
          selectedServicePointForStaff &&
          selectedServicePointForStaff.id && (
            <ServicePointStaffModal
              open={true}
              onClose={() => {
                setShowServicePointStaffModal(false);
                setSelectedServicePointForStaff(null);
              }}
              onSave={async (assignments) => {
                // Service point staff assignments'ı kaydet
                if (
                  onSaveServicePointStaffAssignments &&
                  selectedServicePointForStaff
                ) {
                  await onSaveServicePointStaffAssignments(
                    selectedServicePointForStaff.id,
                    assignments.map((a) => ({
                      id: a.id,
                      staffId: a.staffId,
                      role: a.role,
                      shiftId: a.shiftId,
                      shiftStart: a.shiftStart || "18:00",
                      shiftEnd: a.shiftEnd || "02:00",
                    }))
                  );
                }
                setShowServicePointStaffModal(false);
                setSelectedServicePointForStaff(null);
              }}
              servicePoint={selectedServicePointForStaff}
              allStaff={allStaff}
              workShifts={workShifts}
              existingAssignments={
                selectedServicePointForStaff.staffAssignments
              }
            />
          )}

        {/* Service Point Modal */}
        <Dialog
          open={showServicePointModal}
          onOpenChange={setShowServicePointModal}
        >
          <DialogContent className="bg-slate-800 border-slate-700 max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${spColor}20` }}
                >
                  <Wine className="w-3 h-3" style={{ color: spColor }} />
                </div>
                {editingServicePoint
                  ? "Hizmet Noktası Düzenle"
                  : "Hizmet Noktası Ekle"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* İsim */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nokta Adı</label>
                <Input
                  value={spName}
                  onChange={(e) => setSpName(e.target.value)}
                  placeholder="Örn: Ana Bar, VIP Lounge"
                  className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
                />
              </div>

              {/* Tip Seçimi */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Nokta Tipi</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SERVICE_POINT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setSpPointType(type.value);
                        if (!editingServicePoint) setSpColor(type.color);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 p-1.5 rounded-lg border transition-all text-xs",
                        spPointType === type.value
                          ? "border-cyan-500 bg-cyan-600/20"
                          : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-slate-200 text-xs">
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gerekli Personel Sayısı */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Gerekli Personel Sayısı
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-slate-600 text-xs"
                    onClick={() =>
                      setSpRequiredStaff(Math.max(1, spRequiredStaff - 1))
                    }
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={spRequiredStaff}
                    onChange={(e) =>
                      setSpRequiredStaff(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-16 text-center bg-slate-700 border-slate-600 text-white h-7 text-sm"
                    min={1}
                    max={50}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-slate-600 text-xs"
                    onClick={() =>
                      setSpRequiredStaff(Math.min(50, spRequiredStaff + 1))
                    }
                  >
                    +
                  </Button>
                  <span className="text-xs text-slate-400 ml-1">kişi</span>
                </div>
              </div>

              {/* Personel Görevleri */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Atanabilecek Görevler
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_POINT_ROLES.map((role) => {
                    const isSelected = spAllowedRoles.includes(role.value);
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => handleToggleSpRole(role.value)}
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium transition-all",
                          isSelected
                            ? "ring-1 ring-offset-1 ring-offset-slate-800"
                            : "opacity-50 hover:opacity-75"
                        )}
                        style={
                          {
                            backgroundColor: isSelected
                              ? `${role.color}30`
                              : `${role.color}10`,
                            color: role.color,
                            // @ts-ignore - CSS custom property for ring color
                            "--tw-ring-color": isSelected
                              ? role.color
                              : "transparent",
                          } as React.CSSProperties
                        }
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
                {spAllowedRoles.length === 0 && (
                  <p className="text-[10px] text-amber-400">
                    En az bir görev seçin
                  </p>
                )}
              </div>

              {/* Renk Seçimi */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Renk</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={spColor}
                    onChange={(e) => setSpColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={spColor}
                    onChange={(e) => setSpColor(e.target.value)}
                    className="w-24 bg-slate-700 border-slate-600 text-white font-mono text-xs h-7"
                  />
                  <div className="flex gap-1">
                    {SERVICE_POINT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setSpColor(type.color)}
                        className={cn(
                          "w-5 h-5 rounded-full transition-transform hover:scale-110",
                          spColor === type.color &&
                            "ring-1 ring-white ring-offset-1 ring-offset-slate-800"
                        )}
                        style={{ backgroundColor: type.color }}
                        title={type.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Açıklama */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Açıklama (Opsiyonel)
                </label>
                <Input
                  value={spDescription}
                  onChange={(e) => setSpDescription(e.target.value)}
                  placeholder="Bu hizmet noktası hakkında notlar..."
                  className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowServicePointModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleSaveServicePoint}
                disabled={!spName.trim() || spAllowedRoles.length === 0}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                {editingServicePoint ? "Kaydet" : "Ekle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
