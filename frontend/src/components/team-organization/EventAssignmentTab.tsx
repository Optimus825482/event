"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Users,
  Crown,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  MousePointer2,
  Hand,
  Sofa,
  Save,
  FileDown,
  FileUp,
  Check,
  Eye,
  Briefcase,
  Unlink,
  MapPin,
  Edit,
} from "lucide-react";
import { eventsApi, staffApi, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Staff,
  TableGroup,
  TableData,
  StageElement,
  EventData,
  DEFAULT_COLORS,
} from "./types";

// ==================== CONSTANTS - Venue ile aynı ====================
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 680;
const TABLE_SIZE = 32; // w-8 h-8 = 32px (venue ile aynı)
const LOCA_WIDTH = 56;
const LOCA_HEIGHT = 32;

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

// ==================== TYPES ====================
interface EventAssignmentTabProps {
  eventId: string;
  onChangeStatus?: (hasChanges: boolean) => void;
}

export interface EventAssignmentTabRef {
  save: () => Promise<void>;
  reset: () => Promise<void>;
  hasChanges: boolean;
  saving: boolean;
  openSaveTemplateModal: () => void;
  openLoadTemplateModal: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "canvas" | "table" | "group";
  targetIds: string[];
}

type CanvasTool = "select" | "pan" | "multiSelect";

// ==================== COMPONENT ====================
export const EventAssignmentTab = forwardRef<
  EventAssignmentTabRef,
  EventAssignmentTabProps
>(function EventAssignmentTab({ eventId, onChangeStatus }, ref) {
  // Data State
  const [event, setEvent] = useState<EventData | null>(null);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [supervisors, setSupervisors] = useState<Staff[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Canvas State - Venue ile aynı
  const [zoom, setZoom] = useState(1.0);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [draggingSupervisor, setDraggingSupervisor] = useState<Staff | null>(
    null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Lasso selection state
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);
  const [lassoStart, setLassoStart] = useState({ x: 0, y: 0 });
  const [lassoEnd, setLassoEnd] = useState({ x: 0, y: 0 });
  const lassoJustFinishedRef = useRef(false);

  // UI State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: "canvas",
    targetIds: [],
  });
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showStaffAssignModal, setShowStaffAssignModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(DEFAULT_COLORS[0]);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Çoklu personel seçimi için state
  const [selectedStaffList, setSelectedStaffList] = useState<
    { staffId: string; shiftId: string }[]
  >([]);

  // Ekibe Atama State
  const [showTeamAssignModal, setShowTeamAssignModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Şablon State
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  // Grup Personel Detay Modal State
  const [showGroupStaffModal, setShowGroupStaffModal] = useState(false);
  const [selectedGroupForStaff, setSelectedGroupForStaff] =
    useState<TableGroup | null>(null);

  // Grup Context Menu State
  const [groupContextMenu, setGroupContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    group: TableGroup | null;
  }>({ visible: false, x: 0, y: 0, group: null });

  // Ekip Context Menu State
  const [teamContextMenu, setTeamContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    teamId: string | null;
    team: { id: string; name: string } | null;
  }>({ visible: false, x: 0, y: 0, teamId: null, team: null });

  // Özel Görev Ata State
  const [showSpecialTaskModal, setShowSpecialTaskModal] = useState(false);
  const [specialTaskLocation, setSpecialTaskLocation] = useState("");
  const [selectedStaffForTask, setSelectedStaffForTask] = useState<
    { staffId: string; shiftId: string }[]
  >([]);
  const [specialTaskSearchQuery, setSpecialTaskSearchQuery] = useState("");

  // Atama Detay Modal State
  const [showAssignmentDetailModal, setShowAssignmentDetailModal] =
    useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [editingShiftId, setEditingShiftId] = useState<string>("none");

  // Personel Konum Görüntüleme Modal State
  const [showStaffLocationModal, setShowStaffLocationModal] = useState(false);
  const [selectedStaffForLocation, setSelectedStaffForLocation] =
    useState<any>(null);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // Değişiklik durumunu parent'a bildir
  useEffect(() => {
    onChangeStatus?.(hasChanges);
  }, [hasChanges, onChangeStatus]);

  // Bildirim göster
  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 3000);
    },
    []
  );

  // Veri yükle
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [eventRes, staffRes, teamsRes, shiftsRes, templatesRes] =
          await Promise.all([
            eventsApi.getOne(eventId),
            staffApi.getAll(),
            staffApi.getTeams(),
            staffApi.getShifts(),
            staffApi.getOrganizationTemplates(),
          ]);

        setEvent(eventRes.data);

        const staffList = staffRes.data || [];
        setAllStaff(staffList);

        const supervisorList = staffList.filter(
          (s: Staff) => s.position === "supervizor" && s.isActive
        );
        setSupervisors(supervisorList);

        setTeams(teamsRes.data || []);
        setShifts(shiftsRes.data || []);
        setTemplates(templatesRes.data || []);

        // Masa grupları ve personel atamaları
        try {
          const [groupsRes, assignmentsRes] = await Promise.all([
            staffApi.getEventTableGroups(eventId),
            staffApi.getEventStaffAssignments(eventId),
          ]);
          setTableGroups(groupsRes.data || []);
          setStaffAssignments(assignmentsRes.data || []);
        } catch {
          setTableGroups([]);
          setStaffAssignments([]);
        }
      } catch (error) {
        console.error("Veri yüklenemedi:", error);
        showNotification("error", "Veriler yüklenirken hata oluştu");
      } finally {
        setLoading(false);
      }
    };

    if (eventId) loadData();
  }, [eventId, showNotification]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      setGroupContextMenu((prev) => ({ ...prev, visible: false }));
      setTeamContextMenu((prev) => ({ ...prev, visible: false }));
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Canvas verileri
  const { tables, stageElements } = useMemo(() => {
    const layout = event?.venueLayout;
    const rawTables = layout?.tables || layout?.placedTables || [];
    const rawStages: StageElement[] = layout?.stageElements || [];

    const filteredTables = rawTables.filter((t: any) => !t.isLoca);

    const mappedTables: TableData[] = filteredTables.map((t: any) => ({
      id: t.id,
      label: `${t.tableNumber || ""}`,
      x: t.x || 0,
      y: t.y || 0,
      typeName: t.typeName || t.type,
      type: t.type,
      color: t.color,
      capacity: t.capacity,
      isLoca: false,
    }));

    // Locaları da ekle
    const locaTables = rawTables.filter((t: any) => t.isLoca);
    const mappedLocas: TableData[] = locaTables.map((t: any) => ({
      id: t.id,
      label: t.locaName || `L${t.tableNumber || ""}`,
      x: t.x || 0,
      y: t.y || 0,
      typeName: t.typeName || t.type,
      type: t.type,
      color: t.color,
      capacity: t.capacity,
      isLoca: true,
      locaName: t.locaName,
    }));

    return {
      tables: [...mappedTables, ...mappedLocas],
      stageElements: rawStages,
    };
  }, [event]);

  // Masa'nın hangi gruba ait olduğunu bul
  const getTableGroup = useCallback(
    (tableId: string): TableGroup | undefined => {
      return tableGroups.find((g) => g.tableIds.includes(tableId));
    },
    [tableGroups]
  );

  // Grubun süpervizörünü bul
  const getGroupSupervisor = useCallback(
    (groupId: string): Staff | undefined => {
      const group = tableGroups.find((g) => g.id === groupId);
      if (!group?.assignedSupervisorId) return undefined;
      return supervisors.find((s) => s.id === group.assignedSupervisorId);
    },
    [tableGroups, supervisors]
  );

  // Masaya atanmış personeli bul
  const getTableStaffAssignment = useCallback(
    (tableId: string) => {
      return staffAssignments.find((a: any) => a.tableIds?.includes(tableId));
    },
    [staffAssignments]
  );

  // Gruba atanmış tüm personelleri bul
  const getGroupStaffAssignments = useCallback(
    (groupId: string) => {
      const group = tableGroups.find((g) => g.id === groupId);
      if (!group) return [];

      // Gruptaki masalara atanmış tüm personelleri bul
      const assignments = staffAssignments.filter((a: any) =>
        a.tableIds?.some((tid: string) => group.tableIds.includes(tid))
      );

      return assignments;
    },
    [tableGroups, staffAssignments]
  );

  // Filtrelenmiş personel listesi (arama için)
  const filteredStaff = useMemo(() => {
    if (!staffSearchQuery.trim()) return allStaff;
    const query = staffSearchQuery.toLowerCase();
    return allStaff.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        s.position?.toLowerCase().includes(query)
    );
  }, [allStaff, staffSearchQuery]);

  // Selection summary - seçili masaların tip ve kapasite özeti
  const selectionSummary = useMemo(() => {
    if (selectedTableIds.length === 0) return null;

    const selectedTables = tables.filter((t) =>
      selectedTableIds.includes(t.id)
    );

    // Tip ve kapasiteye göre grupla
    const groups: Record<
      string,
      { count: number; capacity: number; typeName: string }
    > = {};

    for (const table of selectedTables) {
      const typeName = table.typeName || table.type || "Standart";
      const key = `${typeName}-${table.capacity}`;
      if (!groups[key]) {
        groups[key] = { count: 0, capacity: table.capacity || 12, typeName };
      }
      groups[key].count++;
    }

    // Özet dizisi oluştur
    const summaryItems = Object.entries(groups).map(([key, value]) => ({
      typeName: value.typeName,
      capacity: value.capacity,
      count: value.count,
    }));

    // Toplam kapasite
    const totalCapacity = selectedTables.reduce(
      (sum, t) => sum + (t.capacity || 12),
      0
    );

    return {
      items: summaryItems,
      totalCapacity,
      totalCount: selectedTables.length,
    };
  }, [selectedTableIds, tables]);

  // ==================== CANVAS MOUSE HANDLERS - Venue ile aynı ====================
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) return; // Sağ tık

      // Eğer bir masa üzerine tıklandıysa lasso başlatma
      const target = e.target as HTMLElement;
      if (target.closest("[data-table-id]")) {
        return; // Masa tıklaması - handleTableClick halledecek
      }

      // Pan tool
      if (activeTool === "pan") {
        setIsPanning(true);
        setPanStart({
          x: e.clientX - canvasOffset.x,
          y: e.clientY - canvasOffset.y,
        });
        return;
      }

      // Lasso selection - sadece boş alana tıklandığında
      if (activeTool === "select" && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;

        setIsLassoSelecting(true);
        setLassoStart({ x, y });
        setLassoEnd({ x, y });
        // Ctrl veya Shift basılı değilse seçimi temizle
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedTableIds([]);
        }
      }
    },
    [activeTool, canvasOffset, zoom]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Pan
      if (isPanning) {
        setCanvasOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      // Lasso selection
      if (isLassoSelecting && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;
        setLassoEnd({ x, y });

        const minX = Math.min(lassoStart.x, x);
        const maxX = Math.max(lassoStart.x, x);
        const minY = Math.min(lassoStart.y, y);
        const maxY = Math.max(lassoStart.y, y);

        const lassoSelectedIds = tables
          .filter((t) => {
            const tableCenter = {
              x: t.x + TABLE_SIZE / 2,
              y: t.y + TABLE_SIZE / 2,
            };
            return (
              tableCenter.x >= minX &&
              tableCenter.x <= maxX &&
              tableCenter.y >= minY &&
              tableCenter.y <= maxY
            );
          })
          .map((t) => t.id);

        // Ctrl/Shift basılıysa mevcut seçime ekle
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          setSelectedTableIds((prev) => [
            ...new Set([...prev, ...lassoSelectedIds]),
          ]);
        } else {
          setSelectedTableIds(lassoSelectedIds);
        }
      }
    },
    [
      isPanning,
      panStart,
      isLassoSelecting,
      canvasOffset,
      zoom,
      lassoStart,
      tables,
    ]
  );

  const handleMouseUp = useCallback(() => {
    const hadLassoSelection = isLassoSelecting && selectedTableIds.length > 0;

    setIsPanning(false);
    setIsLassoSelecting(false);

    if (hadLassoSelection) {
      lassoJustFinishedRef.current = true;
      setTimeout(() => {
        lassoJustFinishedRef.current = false;
      }, 100);
    }
  }, [isLassoSelecting, selectedTableIds]);

  // Masa tıklama - Gruplu masalar birlikte seçilir, multiSelect modunda tek tek
  const handleTableClick = useCallback(
    (tableId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (lassoJustFinishedRef.current) return;

      // MultiSelect modunda tek tek masa seç (grupları göz ardı et)
      if (activeTool === "multiSelect") {
        setSelectedTableIds((prev) =>
          prev.includes(tableId)
            ? prev.filter((id) => id !== tableId)
            : [...prev, tableId]
        );
        setContextMenu((prev) => ({ ...prev, visible: false }));
        return;
      }

      // Normal mod - Masanın ait olduğu grubu bul
      const group = getTableGroup(tableId);

      // Seçilecek ID'ler - grup varsa tüm grup, yoksa tek masa
      const idsToSelect = group ? [...group.tableIds] : [tableId];

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Ctrl/Shift ile tıklama - grup/masa ekle/çıkar (toggle)
        setSelectedTableIds((prev) => {
          const allSelected = idsToSelect.every((id) => prev.includes(id));
          if (allSelected) {
            // Tümü seçiliyse, tümünü çıkar
            return prev.filter((id) => !idsToSelect.includes(id));
          } else {
            // Değilse, tümünü ekle
            return [...new Set([...prev, ...idsToSelect])];
          }
        });
      } else {
        // Normal tıklama - sadece bu grup/masayı seç
        setSelectedTableIds(idsToSelect);
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [getTableGroup, activeTool]
  );

  // Sağ tık menü
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tableId?: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (tableId) {
        if (!selectedTableIds.includes(tableId)) {
          setSelectedTableIds([tableId]);
        }
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type: "table",
          targetIds: selectedTableIds.includes(tableId)
            ? selectedTableIds
            : [tableId],
        });
      } else {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type: selectedTableIds.length > 0 ? "table" : "canvas",
          targetIds: selectedTableIds,
        });
      }
    },
    [selectedTableIds]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // ==================== GRUP İŞLEMLERİ ====================

  // Otomatik grup ismi oluştur (seçili masalardan)
  const generateAutoGroupName = useCallback(
    (tableIds: string[]): string => {
      if (tableIds.length === 0) return "Yeni Grup";

      // Seçili masaların numaralarını al
      const tableNumbers = tableIds
        .map((id) => {
          const table = tables.find((t) => t.id === id);
          if (!table) return null;
          // Label'dan numara çıkar (örn: "5" -> 5, "L1" -> null)
          const num = parseInt(table.label, 10);
          return isNaN(num) ? null : num;
        })
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);

      if (tableNumbers.length === 0) return "Yeni Grup";

      if (tableNumbers.length === 1) {
        return `${tableNumbers[0]}. Masa`;
      }

      // Tüm numaraları artan sırada virgülle ayırarak yaz
      return `${tableNumbers.join(", ")} Masalar`;
    },
    [tables]
  );

  // Modal açıldığında otomatik isim oluştur
  useEffect(() => {
    if (showGroupModal && selectedTableIds.length > 0) {
      const autoName = generateAutoGroupName(selectedTableIds);
      setNewGroupName(autoName);
    }
  }, [showGroupModal, selectedTableIds, generateAutoGroupName]);

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim() || selectedTableIds.length === 0) {
      showNotification("error", "Grup adı ve en az bir masa seçilmelidir");
      return;
    }

    const newGroup: TableGroup = {
      id: `group-${Date.now()}`,
      eventId,
      name: newGroupName.trim(),
      color: newGroupColor,
      tableIds: [...selectedTableIds],
      groupType: "standard",
      sortOrder: tableGroups.length,
    };

    setTableGroups((prev) => [...prev, newGroup]);
    setSelectedTableIds([]);
    setShowGroupModal(false);
    setNewGroupName("");
    setNewGroupColor(
      DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
    );
    setHasChanges(true);
    showNotification("success", `"${newGroup.name}" grubu oluşturuldu`);
    closeContextMenu();
  }, [
    newGroupName,
    newGroupColor,
    selectedTableIds,
    eventId,
    tableGroups.length,
    showNotification,
    closeContextMenu,
  ]);

  const handleRemoveFromGroup = useCallback(
    (tableIds: string[]) => {
      setTableGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            tableIds: group.tableIds.filter((id) => !tableIds.includes(id)),
          }))
          .filter((group) => group.tableIds.length > 0)
      );
      setSelectedTableIds([]);
      setHasChanges(true);
      showNotification("success", "Masalar gruptan çıkarıldı");
      closeContextMenu();
    },
    [showNotification, closeContextMenu]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      setTableGroups((prev) => prev.filter((g) => g.id !== groupId));
      setHasChanges(true);
      showNotification("success", "Grup silindi");
      closeContextMenu();
    },
    [showNotification, closeContextMenu]
  );

  const handleAddToExistingGroup = useCallback(
    (groupId: string) => {
      setTableGroups((prev) =>
        prev.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              tableIds: [...new Set([...group.tableIds, ...selectedTableIds])],
            };
          }
          return {
            ...group,
            tableIds: group.tableIds.filter(
              (id) => !selectedTableIds.includes(id)
            ),
          };
        })
      );
      setSelectedTableIds([]);
      setHasChanges(true);
      showNotification("success", "Masalar gruba eklendi");
      closeContextMenu();
    },
    [selectedTableIds, showNotification, closeContextMenu]
  );

  // ==================== SÜPERVİZÖR İŞLEMLERİ ====================
  const handleSupervisorDrop = useCallback(
    (supervisor: Staff, targetGroupId: string) => {
      setTableGroups((prev) =>
        prev.map((group) => {
          if (group.id === targetGroupId) {
            return {
              ...group,
              assignedSupervisorId: supervisor.id,
              color: supervisor.color,
            };
          }
          if (group.assignedSupervisorId === supervisor.id) {
            return { ...group, assignedSupervisorId: undefined };
          }
          return group;
        })
      );
      setHasChanges(true);
      showNotification("success", `${supervisor.fullName} gruba atandı`);
      setDraggingSupervisor(null);
    },
    [showNotification]
  );

  const handleRemoveSupervisor = useCallback(
    (groupId: string) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                assignedSupervisorId: undefined,
                color: DEFAULT_COLORS[0],
              }
            : g
        )
      );
      setHasChanges(true);
      showNotification("success", "Süpervizör gruptan kaldırıldı");
    },
    [showNotification]
  );

  // ==================== PERSONEL ATAMA İŞLEMLERİ ====================
  const handleAssignStaff = useCallback(async () => {
    if (selectedStaffList.length === 0 || selectedTableIds.length === 0) {
      showNotification("error", "En az bir personel ve masa seçilmelidir");
      return;
    }

    try {
      // Her seçili personel için atama yap
      for (const { staffId, shiftId } of selectedStaffList) {
        const staff = allStaff.find((s) => s.id === staffId);
        if (!staff) continue;

        // API'ye kaydet ve dönen gerçek ID'yi al
        const response = await staffApi.assignStaffToTables(eventId, {
          staffId,
          tableIds: selectedTableIds,
          shiftId: shiftId && shiftId !== "none" ? shiftId : undefined,
          color: staff.color,
        });

        // Backend'den dönen gerçek assignment'ı kullan
        const savedAssignment = response.data;

        setStaffAssignments((prev) => {
          // Aynı personelin önceki atamasını güncelle veya yeni ekle
          const existingIndex = prev.findIndex(
            (a: any) => a.staffId === staffId
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              id: savedAssignment.id, // Gerçek ID'yi kullan
              tableIds: [
                ...new Set([
                  ...(updated[existingIndex].tableIds || []),
                  ...selectedTableIds,
                ]),
              ],
            };
            return updated;
          }
          // Yeni atama - backend'den dönen veriyi kullan
          return [
            ...prev,
            {
              id: savedAssignment.id,
              eventId,
              staffId,
              staffName: staff.fullName,
              staffColor: staff.color,
              tableIds: savedAssignment.tableIds || selectedTableIds,
              shiftId: savedAssignment.shiftId,
            },
          ];
        });
      }

      setShowStaffAssignModal(false);
      setSelectedStaffList([]);
      setStaffSearchQuery("");
      setSelectedTableIds([]);
      setHasChanges(true);
      showNotification(
        "success",
        `${selectedStaffList.length} personel ${selectedTableIds.length} masaya atandı`
      );
    } catch (error) {
      console.error("Atama hatası:", error);
      showNotification("error", "Personel ataması yapılamadı");
    }
  }, [
    selectedStaffList,
    selectedTableIds,
    allStaff,
    eventId,
    showNotification,
  ]);

  const handleRemoveStaffFromTable = useCallback(
    async (tableId: string) => {
      const assignment = getTableStaffAssignment(tableId);
      if (!assignment) return;

      try {
        // Masayı atamadan çıkar
        const newTableIds = (assignment.tableIds || []).filter(
          (id: string) => id !== tableId
        );

        // Geçici ID kontrolü - temp- ile başlıyorsa sadece local state güncelle
        const isTemporaryId =
          assignment.id && assignment.id.toString().startsWith("temp-");

        if (newTableIds.length === 0) {
          // Tüm masalar çıkarıldıysa atamayı sil
          if (!isTemporaryId) {
            await staffApi.removeStaffAssignment(assignment.id);
          }
          setStaffAssignments((prev) =>
            prev.filter((a: any) => a.id !== assignment.id)
          );
        } else {
          // Güncelle
          if (!isTemporaryId) {
            await staffApi.updateStaffAssignment(assignment.id, {
              tableIds: newTableIds,
            });
          }
          setStaffAssignments((prev) =>
            prev.map((a: any) =>
              a.id === assignment.id ? { ...a, tableIds: newTableIds } : a
            )
          );
        }

        setHasChanges(true);
        showNotification("success", "Personel masadan kaldırıldı");
      } catch (error) {
        console.error("Kaldırma hatası:", error);
        showNotification("error", "Personel kaldırılamadı");
      }
    },
    [getTableStaffAssignment, showNotification]
  );

  // ==================== EKİBE ATAMA İŞLEMLERİ ====================
  const handleAssignToTeam = useCallback(async () => {
    if (!selectedTeamId || selectedTableIds.length === 0) {
      showNotification("error", "Ekip ve en az bir masa seçilmelidir");
      return;
    }

    try {
      const team = teams.find((t: any) => t.id === selectedTeamId);
      if (!team) return;

      // Seçili masaların ait olduğu grupları bul
      const affectedGroupIds = new Set<string>();
      selectedTableIds.forEach((tableId) => {
        const group = tableGroups.find((g) => g.tableIds.includes(tableId));
        if (group) {
          affectedGroupIds.add(group.id);
        }
      });

      // Grupları ekibe ata
      setTableGroups((prev) =>
        prev.map((group) => {
          if (affectedGroupIds.has(group.id)) {
            return {
              ...group,
              assignedTeamId: selectedTeamId,
              color: team.color,
            };
          }
          return group;
        })
      );

      // Eğer seçili masalar hiçbir gruba ait değilse, yeni grup oluştur
      const ungroupedTables = selectedTableIds.filter(
        (tableId) => !tableGroups.some((g) => g.tableIds.includes(tableId))
      );

      if (ungroupedTables.length > 0) {
        const newGroup: TableGroup = {
          id: `group-${Date.now()}`,
          eventId,
          name: `${team.name} - Bölge`,
          color: team.color,
          tableIds: ungroupedTables,
          groupType: "team",
          assignedTeamId: selectedTeamId,
          sortOrder: tableGroups.length,
        };
        setTableGroups((prev) => [...prev, newGroup]);
      }

      setShowTeamAssignModal(false);
      setSelectedTeamId("");
      setSelectedTableIds([]);
      setHasChanges(true);
      showNotification("success", `Masalar "${team.name}" ekibine atandı`);
    } catch (error) {
      console.error("Ekibe atama hatası:", error);
      showNotification("error", "Ekibe atama yapılamadı");
    }
  }, [
    selectedTeamId,
    selectedTableIds,
    teams,
    eventId,
    tableGroups,
    showNotification,
  ]);

  // Ekipten grupları çıkar
  const handleRemoveGroupsFromTeam = useCallback(
    (teamId: string) => {
      setTableGroups((prev) =>
        prev.map((group) => {
          if (group.assignedTeamId === teamId) {
            return {
              ...group,
              assignedTeamId: undefined,
            };
          }
          return group;
        })
      );
      setHasChanges(true);
      showNotification("success", "Gruplar ekipten çıkarıldı");
    },
    [showNotification]
  );

  // Ekibe ait masaları seç
  const selectTeamTables = useCallback(
    (teamId: string) => {
      const teamGroups = tableGroups.filter((g) => g.assignedTeamId === teamId);
      const teamTableIds = teamGroups.flatMap((g) => g.tableIds);
      setSelectedTableIds(teamTableIds);
    },
    [tableGroups]
  );

  // ==================== KAYDET / SIFIRLA ====================
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await staffApi.saveEventTableGroups(
        eventId,
        tableGroups.map((g) => ({
          id: g.id.startsWith("group-") ? undefined : g.id,
          name: g.name,
          color: g.color,
          tableIds: g.tableIds,
          groupType: g.groupType,
          assignedTeamId: g.assignedTeamId,
          assignedSupervisorId: g.assignedSupervisorId,
          notes: g.notes,
          sortOrder: g.sortOrder,
        }))
      );
      setHasChanges(false);
      showNotification("success", "Ekip organizasyonu kaydedildi");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      showNotification("error", "Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }, [eventId, tableGroups, showNotification]);

  const handleReset = useCallback(async () => {
    try {
      setLoading(true);
      const groupsRes = await staffApi.getEventTableGroups(eventId);
      setTableGroups(groupsRes.data || []);
      setSelectedTableIds([]);
      setHasChanges(false);
      showNotification("success", "Değişiklikler geri alındı");
    } catch {
      showNotification("error", "Sıfırlama sırasında hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [eventId, showNotification]);

  // ==================== ŞABLON İŞLEMLERİ ====================
  const handleSaveTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      showNotification("error", "Şablon adı gereklidir");
      return;
    }

    try {
      // Önce mevcut organizasyonu kaydet
      await handleSave();

      // Şablon oluştur
      const result = await staffApi.createOrganizationTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        eventId,
      });

      setTemplates((prev) => [result.data, ...prev]);
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      showNotification("success", `"${newTemplateName}" şablonu kaydedildi`);
    } catch (error) {
      console.error("Şablon kaydetme hatası:", error);
      showNotification("error", "Şablon kaydedilemedi");
    }
  }, [
    newTemplateName,
    newTemplateDescription,
    eventId,
    handleSave,
    showNotification,
  ]);

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      try {
        const template = templates.find((t: any) => t.id === templateId);
        if (!template) return;

        await staffApi.applyOrganizationTemplate(templateId, eventId);

        // Verileri yeniden yükle
        const [groupsRes, assignmentsRes] = await Promise.all([
          staffApi.getEventTableGroups(eventId),
          staffApi.getEventStaffAssignments(eventId),
        ]);

        setTableGroups(groupsRes.data || []);
        setStaffAssignments(assignmentsRes.data || []);
        setShowLoadTemplateModal(false);
        setHasChanges(false);
        showNotification("success", `"${template.name}" şablonu uygulandı`);
      } catch (error) {
        console.error("Şablon uygulama hatası:", error);
        showNotification("error", "Şablon uygulanamadı");
      }
    },
    [templates, eventId, showNotification]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        await staffApi.deleteOrganizationTemplate(templateId);
        setTemplates((prev) => prev.filter((t: any) => t.id !== templateId));
        showNotification("success", "Şablon silindi");
      } catch (error) {
        console.error("Şablon silme hatası:", error);
        showNotification("error", "Şablon silinemedi");
      }
    },
    [showNotification]
  );

  // ==================== ÖZEL GÖREV ATAMA ====================
  const handleAssignSpecialTask = useCallback(async () => {
    if (selectedStaffForTask.length === 0 || !specialTaskLocation.trim()) {
      showNotification("error", "En az bir personel ve görev yeri gereklidir");
      return;
    }

    try {
      // Her seçili personel için özel görev ataması yap
      for (const { staffId, shiftId } of selectedStaffForTask) {
        const staff = allStaff.find((s) => s.id === staffId);
        if (!staff) continue;

        // Vardiya bilgisini al
        const shift =
          shiftId && shiftId !== "none"
            ? shifts.find((sh: any) => sh.id === shiftId)
            : null;

        // API'ye kaydet - özel görev olarak
        await staffApi.assignStaffToTables(eventId, {
          staffId,
          tableIds: [], // Boş - masa ataması yok
          shiftId: shiftId && shiftId !== "none" ? shiftId : undefined,
          assignmentType: "special_task",
          specialTaskLocation: specialTaskLocation.trim(),
          specialTaskStartTime: shift?.startTime || undefined,
          specialTaskEndTime: shift?.endTime || undefined,
          color: staff.color,
        });

        // Local state güncelle
        const newAssignment = {
          id: `temp-task-${Date.now()}-${staffId}`,
          eventId,
          staffId,
          staffName: staff.fullName,
          staffColor: staff.color,
          tableIds: [],
          shiftId: shiftId && shiftId !== "none" ? shiftId : undefined,
          assignmentType: "special_task",
          specialTaskLocation: specialTaskLocation.trim(),
          specialTaskStartTime: shift?.startTime || undefined,
          specialTaskEndTime: shift?.endTime || undefined,
        };

        setStaffAssignments((prev) => [...prev, newAssignment]);
      }

      setShowSpecialTaskModal(false);
      setSelectedStaffForTask([]);
      setSpecialTaskLocation("");
      setSpecialTaskSearchQuery("");
      setHasChanges(true);
      showNotification(
        "success",
        `${selectedStaffForTask.length} personele özel görev atandı`
      );
    } catch (error) {
      console.error("Özel görev atama hatası:", error);
      showNotification("error", "Özel görev ataması yapılamadı");
    }
  }, [
    selectedStaffForTask,
    specialTaskLocation,
    allStaff,
    shifts,
    eventId,
    showNotification,
  ]);

  // Özel görev için filtrelenmiş personel listesi
  const filteredStaffForTask = useMemo(() => {
    if (!specialTaskSearchQuery.trim()) return allStaff;
    const query = specialTaskSearchQuery.toLowerCase();
    return allStaff.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        s.position?.toLowerCase().includes(query)
    );
  }, [allStaff, specialTaskSearchQuery]);

  // Atama detay modalını aç
  const openAssignmentDetail = useCallback((assignment: any) => {
    setSelectedAssignment(assignment);
    setEditingShiftId(assignment.shiftId || "none");
    setShowAssignmentDetailModal(true);
  }, []);

  // Personel konum modalını aç
  const openStaffLocationModal = useCallback(
    (assignment: any) => {
      const staff = allStaff.find((s) => s.id === assignment.staffId);
      if (!staff) return;

      // Personelin atandığı masa grubunu bul
      const assignedTableIds = assignment.tableIds || [];
      const assignedGroup = tableGroups.find((g) =>
        g.tableIds.some((tid) => assignedTableIds.includes(tid))
      );

      setSelectedStaffForLocation({
        ...assignment,
        staff,
        assignedGroup,
        assignedTableIds,
      });
      setShowStaffLocationModal(true);
    },
    [allStaff, tableGroups]
  );

  // Atama vardiyasını güncelle
  const handleUpdateAssignmentShift = useCallback(async () => {
    if (!selectedAssignment) return;

    try {
      const newShiftId = editingShiftId === "none" ? undefined : editingShiftId;

      // API'ye güncelle
      await staffApi.updateStaffAssignment(selectedAssignment.id, {
        shiftId: newShiftId,
      });

      // Local state güncelle
      setStaffAssignments((prev) =>
        prev.map((a: any) =>
          a.id === selectedAssignment.id ? { ...a, shiftId: newShiftId } : a
        )
      );

      setHasChanges(true);
      showNotification("success", "Vardiya güncellendi");
      setShowAssignmentDetailModal(false);
      setSelectedAssignment(null);
    } catch (error) {
      console.error("Vardiya güncelleme hatası:", error);
      showNotification("error", "Vardiya güncellenemedi");
    }
  }, [selectedAssignment, editingShiftId, showNotification]);

  // Atamayı sil
  const handleDeleteAssignment = useCallback(async () => {
    if (!selectedAssignment) return;

    try {
      await staffApi.removeStaffAssignment(selectedAssignment.id);

      setStaffAssignments((prev) =>
        prev.filter((a: any) => a.id !== selectedAssignment.id)
      );

      setHasChanges(true);
      showNotification("success", "Atama kaldırıldı");
      setShowAssignmentDetailModal(false);
      setSelectedAssignment(null);
    } catch (error) {
      console.error("Atama silme hatası:", error);
      showNotification("error", "Atama kaldırılamadı");
    }
  }, [selectedAssignment, showNotification]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      reset: handleReset,
      hasChanges,
      saving,
      openSaveTemplateModal: () => setShowSaveTemplateModal(true),
      openLoadTemplateModal: () => setShowLoadTemplateModal(true),
    }),
    [handleSave, handleReset, hasChanges, saving]
  );

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-xl">
        <div className="text-center space-y-4">
          <Users className="h-16 w-16 mx-auto text-slate-600" />
          <h3 className="text-lg font-medium text-white">
            Alan Planı Bulunamadı
          </h3>
          <p className="text-slate-400">
            Bu etkinlik için henüz alan planı oluşturulmamış.
          </p>
        </div>
      </div>
    );
  }

  // Normal masalar ve localar
  const normalTables = tables.filter((t) => !t.isLoca);
  const locaTables = tables.filter((t) => t.isLoca);

  // ==================== MAIN RENDER ====================
  return (
    <div
      className={`bg-slate-900 rounded-xl overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[200] px-4 py-2 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Toolbar - Venue ile aynı yapı */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Tools */}
          <Button
            variant={activeTool === "select" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("select")}
            className={activeTool === "select" ? "bg-blue-600" : ""}
            title="Seçim Aracı"
          >
            <MousePointer2 className="w-4 h-4" />
          </Button>
          <Button
            variant={activeTool === "multiSelect" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("multiSelect")}
            className={activeTool === "multiSelect" ? "bg-emerald-600" : ""}
            title="Çoklu Seçim (Tek tek ekle)"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant={activeTool === "pan" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("pan")}
            className={activeTool === "pan" ? "bg-blue-600" : ""}
            title="Kaydırma (Space)"
          >
            <Hand className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-slate-700 mx-2" />

          {/* Stats */}
          <Badge className="bg-slate-700 text-slate-300 border-slate-600">
            {normalTables.length} Masa
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            {tableGroups.length} Grup
          </Badge>

          {/* Selection Summary */}
          {selectionSummary && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-2" />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Seçili:</span>
                <div className="flex flex-wrap gap-1 max-w-[350px]">
                  {selectionSummary.items.map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="bg-slate-700/50 text-slate-200 border-slate-600 text-[10px] px-1.5 py-0"
                    >
                      {item.count}x {item.typeName} {item.capacity}K
                    </Badge>
                  ))}
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  Σ {selectionSummary.totalCapacity} Kişi
                </Badge>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-400 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setZoom(1.0);
              setCanvasOffset({ x: 0, y: 0 });
            }}
            title="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-slate-700 mx-2" />

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className={isFullscreen ? "text-yellow-400" : ""}
            title="Tam Ekran"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Layout - Venue ile aynı yapı */}
      <div
        className={`grid gap-0 ${
          isFullscreen ? "grid-cols-1" : "grid-cols-12"
        }`}
      >
        {/* Left Panel */}
        {!isFullscreen && (
          <div className="col-span-3 border-r border-slate-700 bg-slate-800/30 p-3 space-y-3 h-[580px] overflow-y-auto">
            {/* Ekipler - YENİ */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Ekipler
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] bg-purple-500/10 border-purple-500/30 text-purple-400"
                  >
                    {teams.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teams.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Henüz ekip yok
                  </p>
                ) : (
                  teams.map((team) => {
                    const leader = allStaff.find((s) => s.id === team.leaderId);
                    // Ekibe atanmış grupları bul
                    const teamGroups = tableGroups.filter(
                      (g) => g.assignedTeamId === team.id
                    );
                    // Ekibe ait tüm masa ID'lerini topla
                    const teamTableIds = teamGroups.flatMap((g) => g.tableIds);
                    const teamTableCount = teamTableIds.length;

                    // Ekibe ait masalara atanmış personelleri bul (unique)
                    const teamStaffIds = new Set<string>();
                    staffAssignments.forEach((assignment: any) => {
                      if (
                        assignment.tableIds?.some((tid: string) =>
                          teamTableIds.includes(tid)
                        )
                      ) {
                        teamStaffIds.add(assignment.staffId);
                      }
                    });
                    const memberCount = teamStaffIds.size;

                    const isTeamSelected =
                      teamGroups.length > 0 &&
                      teamGroups.every((g) =>
                        g.tableIds.every((id) => selectedTableIds.includes(id))
                      );

                    return (
                      <div
                        key={team.id}
                        onClick={() => selectTeamTables(team.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTeamContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            teamId: team.id,
                            team: { id: team.id, name: team.name },
                          });
                        }}
                        className={`p-2 rounded-lg border cursor-pointer transition-all ${
                          isTeamSelected
                            ? "bg-purple-600/20 border-purple-500"
                            : "bg-slate-700/50 border-slate-600 hover:border-purple-400"
                        }`}
                        style={{
                          borderLeftColor: team.color,
                          borderLeftWidth: 4,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white truncate">
                            {team.name}
                          </span>
                          <div className="flex items-center gap-1">
                            {teamTableCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-purple-500/20 text-purple-300"
                              >
                                {teamTableCount} masa
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-slate-600 text-slate-300"
                            >
                              {memberCount} üye
                            </Badge>
                          </div>
                        </div>
                        {leader && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getAvatarUrl(leader.avatar)} />
                              <AvatarFallback
                                style={{ backgroundColor: leader.color }}
                                className="text-white text-[8px]"
                              >
                                {leader.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] text-slate-400 truncate">
                              {leader.fullName}
                            </span>
                          </div>
                        )}
                        {/* Ekibe atanmış gruplar */}
                        {teamGroups.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {teamGroups.slice(0, 3).map((group) => (
                              <Badge
                                key={group.id}
                                variant="outline"
                                className="text-[9px] bg-slate-600/50 text-slate-300 border-slate-500"
                              >
                                {group.name}
                              </Badge>
                            ))}
                            {teamGroups.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-slate-600/50 text-slate-300 border-slate-500"
                              >
                                +{teamGroups.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Süpervizörler */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  Süpervizörler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {supervisors.map((supervisor) => {
                  const assignedGroup = tableGroups.find(
                    (g) => g.assignedSupervisorId === supervisor.id
                  );
                  return (
                    <div
                      key={supervisor.id}
                      draggable
                      onDragStart={() => setDraggingSupervisor(supervisor)}
                      onDragEnd={() => setDraggingSupervisor(null)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                        assignedGroup
                          ? "bg-slate-700/50 border-slate-600 opacity-60"
                          : "bg-slate-700 border-slate-600 hover:border-purple-500"
                      }`}
                      style={{
                        borderLeftColor: supervisor.color,
                        borderLeftWidth: 4,
                      }}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(supervisor.avatar)} />
                        <AvatarFallback
                          style={{ backgroundColor: supervisor.color }}
                          className="text-white text-xs"
                        >
                          {supervisor.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {supervisor.fullName}
                        </p>
                        {assignedGroup && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {assignedGroup.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {supervisors.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Süpervizör bulunamadı
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Gruplar */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  Masa Grupları
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-400"
                  >
                    {tableGroups.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tableGroups.map((group) => {
                  const supervisor = getGroupSupervisor(group.id);
                  const groupAssignments = getGroupStaffAssignments(group.id);
                  const assignedStaffList = groupAssignments
                    .map((a: any) => allStaff.find((s) => s.id === a.staffId))
                    .filter(Boolean);
                  const isGroupSelected = group.tableIds.every((id) =>
                    selectedTableIds.includes(id)
                  );

                  return (
                    <div
                      key={group.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingSupervisor)
                          handleSupervisorDrop(draggingSupervisor, group.id);
                      }}
                      onClick={() => setSelectedTableIds([...group.tableIds])}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setGroupContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          group,
                        });
                      }}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        isGroupSelected
                          ? "bg-blue-600/20 border-blue-500"
                          : draggingSupervisor
                          ? "bg-slate-700/50 border-purple-500 border-dashed"
                          : "bg-slate-700/50 border-slate-600 hover:border-blue-400"
                      }`}
                      style={{
                        borderLeftColor: group.color,
                        borderLeftWidth: 4,
                      }}
                      title={
                        assignedStaffList.length > 0
                          ? `Atanmış: ${assignedStaffList
                              .map((s: any) => s.fullName)
                              .join(", ")}`
                          : "Henüz personel atanmamış"
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white truncate flex-1">
                          {group.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-600 text-slate-300"
                          >
                            {group.tableIds.length}
                          </Badge>
                          {assignedStaffList.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-emerald-500/20 text-emerald-400"
                            >
                              {assignedStaffList.length} kişi
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-400 hover:text-blue-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroupForStaff(group);
                              setShowGroupStaffModal(true);
                            }}
                            title="Personelleri Görüntüle"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-500 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {supervisor && (
                        <div className="flex items-center gap-1 mt-1">
                          <Crown className="h-3 w-3 text-amber-400" />
                          <span className="text-[10px] text-slate-400 flex-1">
                            {supervisor.fullName}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-slate-500 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSupervisor(group.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {/* Atanmış personel avatarları */}
                      {assignedStaffList.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {assignedStaffList.slice(0, 4).map((staff: any) => (
                            <Avatar
                              key={staff.id}
                              className="h-5 w-5 border border-slate-600"
                            >
                              <AvatarImage src={getAvatarUrl(staff.avatar)} />
                              <AvatarFallback
                                style={{ backgroundColor: staff.color }}
                                className="text-white text-[7px]"
                              >
                                {staff.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {assignedStaffList.length > 4 && (
                            <span className="text-[9px] text-slate-400">
                              +{assignedStaffList.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {tableGroups.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Henüz grup yok
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Seçili masalar için aksiyon */}
            {selectedTableIds.length > 0 && (
              <div className="space-y-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm"
                  onClick={() => setShowStaffAssignModal(true)}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Personel Ata
                </Button>
                {teams.length > 0 && (
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-sm"
                    onClick={() => setShowTeamAssignModal(true)}
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Ekibe Ata
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 text-sm"
                  onClick={() => setShowGroupModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {selectedTableIds.length} Masadan Grup Oluştur
                </Button>
              </div>
            )}

            {/* Atanmış Personeller */}
            {staffAssignments.length > 0 && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    Atanmış Personeller
                    <Badge
                      variant="outline"
                      className="ml-auto text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    >
                      {staffAssignments.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {staffAssignments.map((assignment: any) => {
                    const staff = allStaff.find(
                      (s) => s.id === assignment.staffId
                    );
                    const shift = shifts.find(
                      (sh: any) => sh.id === assignment.shiftId
                    );
                    if (!staff) return null;

                    const isSpecialTask =
                      assignment.assignmentType === "special_task";

                    return (
                      <div
                        key={assignment.id}
                        onClick={() => {
                          // Özel görev değilse ve masa ataması varsa konum modalını aç
                          if (
                            !isSpecialTask &&
                            assignment.tableIds?.length > 0
                          ) {
                            openStaffLocationModal(assignment);
                          } else {
                            openAssignmentDetail(assignment);
                          }
                        }}
                        className={`p-2 rounded-lg border bg-slate-700/50 cursor-pointer hover:bg-slate-700 transition-colors ${
                          isSpecialTask
                            ? "border-amber-500/50 hover:border-amber-400"
                            : "border-slate-600 hover:border-slate-500"
                        }`}
                        style={{
                          borderLeftColor: isSpecialTask
                            ? "#f59e0b"
                            : staff.color,
                          borderLeftWidth: 4,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={getAvatarUrl(staff.avatar)} />
                            <AvatarFallback
                              style={{ backgroundColor: staff.color }}
                              className="text-white text-[8px]"
                            >
                              {staff.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {staff.fullName}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {isSpecialTask ? (
                                <>
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] bg-amber-500/20 text-amber-400"
                                  >
                                    <Briefcase className="h-2.5 w-2.5 mr-0.5" />
                                    {assignment.specialTaskLocation}
                                  </Badge>
                                  {shift && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px]"
                                      style={{
                                        backgroundColor: `${shift.color}20`,
                                        color: shift.color,
                                        borderColor: `${shift.color}50`,
                                      }}
                                    >
                                      {shift.name}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] bg-slate-600 text-slate-300"
                                  >
                                    {assignment.tableIds?.length || 0} masa
                                  </Badge>
                                  {shift && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px]"
                                      style={{
                                        backgroundColor: `${shift.color}20`,
                                        color: shift.color,
                                        borderColor: `${shift.color}50`,
                                      }}
                                    >
                                      {shift.name}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Canvas - Venue ile birebir aynı yapı */}
        <div className={isFullscreen ? "col-span-1" : "col-span-9"}>
          <Card className="bg-slate-800 border-slate-700 overflow-hidden rounded-none">
            <div
              ref={canvasRef}
              className={`relative bg-slate-900 overflow-hidden ${
                activeTool === "pan" ? "cursor-grab" : "cursor-default"
              } ${isPanning ? "cursor-grabbing" : ""}`}
              style={{
                width: "100%",
                height: isFullscreen ? "calc(100vh - 50px)" : 580,
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseDown={handleCanvasMouseDown}
              onContextMenu={(e) => handleContextMenu(e)}
              onClick={() => {
                if (lassoJustFinishedRef.current) return;
                if (activeTool === "select" && !isLassoSelecting) {
                  setSelectedTableIds([]);
                }
              }}
            >
              {/* Canvas Content */}
              <div
                style={{
                  transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                  transformOrigin: "top left",
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  position: "relative",
                }}
              >
                {/* Stage Elements */}
                {stageElements.map((element) => (
                  <div
                    key={element.id}
                    className="absolute select-none"
                    style={{
                      left: element.x,
                      top: element.y,
                      width: element.width,
                      height: element.height,
                    }}
                  >
                    <div
                      className={`w-full h-full rounded-lg flex items-center justify-center ${
                        element.type === "stage"
                          ? "bg-blue-600"
                          : element.type === "system_control"
                          ? "bg-amber-600"
                          : "bg-purple-500"
                      }`}
                    >
                      <span className="text-xs font-medium text-white">
                        {element.label}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Normal Tables - Venue ile aynı boyut (w-8 h-8 = 32px) */}
                {normalTables.map((table) => {
                  const group = getTableGroup(table.id);
                  const isSelected = selectedTableIds.includes(table.id);
                  const staffAssignment = getTableStaffAssignment(table.id);
                  const assignedStaff = staffAssignment
                    ? allStaff.find((s) => s.id === staffAssignment.staffId)
                    : null;
                  const tableColor =
                    assignedStaff?.color ||
                    group?.color ||
                    table.color ||
                    "#6b7280";

                  return (
                    <div
                      key={table.id}
                      data-table-id={table.id}
                      className={`absolute select-none transition-transform ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10"
                          : ""
                      }`}
                      style={{
                        left: table.x,
                        top: table.y,
                        cursor: "pointer",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleTableClick(table.id, e)}
                      onContextMenu={(e) => handleContextMenu(e, table.id)}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2 relative"
                        style={{
                          backgroundColor: tableColor,
                          borderColor: isSelected
                            ? "#fbbf24"
                            : assignedStaff
                            ? "#10b981"
                            : "#9ca3af",
                        }}
                      >
                        <span className="text-[9px] font-bold">
                          {table.label}
                        </span>
                        {/* Atanmış personel göstergesi */}
                        {assignedStaff && (
                          <div
                            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center"
                            title={assignedStaff.fullName}
                          >
                            <span className="text-[6px] font-bold text-white">
                              {assignedStaff.fullName.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Locas - Venue ile aynı boyut */}
                {locaTables.map((loca) => {
                  const group = getTableGroup(loca.id);
                  const isSelected = selectedTableIds.includes(loca.id);
                  const locaColor = group?.color || loca.color || "#ec4899";

                  return (
                    <div
                      key={loca.id}
                      data-table-id={loca.id}
                      className={`absolute select-none ${
                        isSelected ? "ring-2 ring-white z-10" : ""
                      }`}
                      style={{
                        left: loca.x,
                        top: loca.y,
                        cursor: "pointer",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleTableClick(loca.id, e)}
                      onContextMenu={(e) => handleContextMenu(e, loca.id)}
                    >
                      <div
                        className="rounded-lg flex flex-col items-center justify-center text-white shadow-lg border"
                        style={{
                          width: LOCA_WIDTH,
                          height: LOCA_HEIGHT,
                          backgroundColor: locaColor,
                          borderColor: isSelected ? "#fbbf24" : "#f472b6",
                        }}
                      >
                        <Sofa className="w-3 h-3" />
                        <span className="text-[9px] font-bold">
                          {loca.locaName || loca.label}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Lasso Selection */}
                {isLassoSelecting && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                    style={{
                      left: Math.min(lassoStart.x, lassoEnd.x),
                      top: Math.min(lassoStart.y, lassoEnd.y),
                      width: Math.abs(lassoEnd.x - lassoStart.x),
                      height: Math.abs(lassoEnd.y - lassoStart.y),
                    }}
                  />
                )}
              </div>

              {/* Selection info */}
              {selectedTableIds.length > 0 && (
                <div className="absolute bottom-4 left-4 z-40 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs shadow-lg">
                  {selectedTableIds.length} masa seçili
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-[100] min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "table" && contextMenu.targetIds.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-slate-500 font-medium">
                {contextMenu.targetIds.length} Masa Seçili
              </div>

              {/* Personel Ata - YENİ */}
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-emerald-400 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  setShowStaffAssignModal(true);
                  closeContextMenu();
                }}
              >
                <Users className="w-4 h-4" />
                Personel Ata
              </button>

              {/* Ekibe Ata */}
              {teams.length > 0 && (
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-purple-400 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    setShowTeamAssignModal(true);
                    closeContextMenu();
                  }}
                >
                  <Crown className="w-4 h-4" />
                  Ekibe Ata
                </button>
              )}

              <div className="border-t border-slate-700 my-1" />

              <button
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  setShowGroupModal(true);
                  closeContextMenu();
                }}
              >
                <Plus className="w-4 h-4" />
                Yeni Grup Oluştur
              </button>

              {tableGroups.length > 0 && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  <div className="px-3 py-1 text-xs text-slate-500">
                    Gruba Ekle
                  </div>
                  {tableGroups.map((group) => (
                    <button
                      key={group.id}
                      className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => handleAddToExistingGroup(group.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </button>
                  ))}
                </>
              )}

              {contextMenu.targetIds.some((id) => getTableGroup(id)) && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  {/* Seçili masaların hepsi aynı gruptaysa "Grubu Dağıt" göster */}
                  {(() => {
                    const firstGroup = getTableGroup(contextMenu.targetIds[0]);
                    // Tüm seçili masalar aynı gruptaysa "Grubu Dağıt" göster
                    const allSameGroup =
                      firstGroup &&
                      contextMenu.targetIds.every(
                        (id) => getTableGroup(id)?.id === firstGroup.id
                      );
                    if (allSameGroup && firstGroup) {
                      return (
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => {
                            handleDeleteGroup(firstGroup.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Grubu Dağıt ({firstGroup.name})
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => handleRemoveFromGroup(contextMenu.targetIds)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Gruptan Çıkar
                  </button>
                </>
              )}

              {/* Personel Kaldır - atanmış masalar için */}
              {contextMenu.targetIds.some((id) =>
                getTableStaffAssignment(id)
              ) && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm text-orange-400 hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => {
                      contextMenu.targetIds.forEach((id) => {
                        if (getTableStaffAssignment(id)) {
                          handleRemoveStaffFromTable(id);
                        }
                      });
                      closeContextMenu();
                    }}
                  >
                    <X className="w-4 h-4" />
                    Personeli Kaldır
                  </button>
                </>
              )}
            </>
          )}

          {/* Canvas (boş alan) sağ tık menüsü */}
          {contextMenu.type === "canvas" && (
            <>
              <div className="px-3 py-1.5 text-xs text-slate-500 font-medium">
                Etkinlik Alanı
              </div>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  setShowSpecialTaskModal(true);
                  closeContextMenu();
                }}
              >
                <Briefcase className="w-4 h-4" />
                Özel Görev Ata
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  setShowSaveTemplateModal(true);
                  closeContextMenu();
                }}
              >
                <Save className="w-4 h-4" />
                Şablon Olarak Kaydet
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-purple-400 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  setShowLoadTemplateModal(true);
                  closeContextMenu();
                }}
              >
                <FileDown className="w-4 h-4" />
                Şablon Yükle
              </button>
            </>
          )}
        </div>
      )}

      {/* Grup Context Menu */}
      {groupContextMenu.visible && groupContextMenu.group && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-[100] min-w-[180px]"
          style={{ left: groupContextMenu.x, top: groupContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-700">
            {groupContextMenu.group.name}
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-emerald-400 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              setSelectedTableIds([...groupContextMenu.group!.tableIds]);
              setShowStaffAssignModal(true);
              setGroupContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Users className="w-4 h-4" />
            Personel Ekle
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              setSelectedGroupForStaff(groupContextMenu.group);
              setShowGroupStaffModal(true);
              setGroupContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Eye className="w-4 h-4" />
            Personelleri Görüntüle
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              handleDeleteGroup(groupContextMenu.group!.id);
              setGroupContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Trash2 className="w-4 h-4" />
            Grubu Dağıt
          </button>
        </div>
      )}

      {/* Ekip Context Menu */}
      {teamContextMenu.visible && teamContextMenu.team && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-[100] min-w-[200px]"
          style={{ left: teamContextMenu.x, top: teamContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-700">
            {teamContextMenu.team.name}
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              selectTeamTables(teamContextMenu.team!.id);
              setTeamContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <MousePointer2 className="w-4 h-4" />
            Masaları Seç
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              handleRemoveGroupsFromTeam(teamContextMenu.team!.id);
              setTeamContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Unlink className="w-4 h-4" />
            Grupları Ekipten Çıkar
          </button>
        </div>
      )}

      {/* Group Modal */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Yeni Grup Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Grup Adı</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Örn: A Bölgesi"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Grup Rengi</Label>
              <Select value={newGroupColor} onValueChange={setNewGroupColor}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: newGroupColor }}
                      />
                      {newGroupColor}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {DEFAULT_COLORS.map((color) => (
                    <SelectItem
                      key={color}
                      value={color}
                      className="text-white hover:bg-slate-600"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        {color}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-400">
              Seçili masalar: {selectedTableIds.length}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGroupModal(false)}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Assign Modal - Çoklu Seçim */}
      <Dialog
        open={showStaffAssignModal}
        onOpenChange={(open) => {
          setShowStaffAssignModal(open);
          if (!open) {
            setSelectedStaffList([]);
            setStaffSearchQuery("");
          }
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              Personel Ata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seçili masalar */}
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Seçili Masalar</p>
              <div className="flex flex-wrap gap-1">
                {selectedTableIds.slice(0, 10).map((id) => {
                  const table = tables.find((t) => t.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="bg-slate-600 text-slate-200 text-xs"
                    >
                      {table?.label || id}
                    </Badge>
                  );
                })}
                {selectedTableIds.length > 10 && (
                  <Badge
                    variant="secondary"
                    className="bg-slate-600 text-slate-200 text-xs"
                  >
                    +{selectedTableIds.length - 10} daha
                  </Badge>
                )}
              </div>
            </div>

            {/* Personel Arama ve Seçim */}
            <div className="space-y-2">
              <Label className="text-slate-300">Personel Seç (Çoklu)</Label>
              <Input
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="İsim veya pozisyon ara..."
                className="bg-slate-700 border-slate-600 text-white"
              />
              <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-600 rounded-lg p-2">
                {filteredStaff.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Personel bulunamadı
                  </p>
                ) : (
                  filteredStaff.map((staff) => {
                    const isSelected = selectedStaffList.some(
                      (s) => s.staffId === staff.id
                    );
                    return (
                      <div
                        key={staff.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaffList((prev) =>
                              prev.filter((s) => s.staffId !== staff.id)
                            );
                          } else {
                            setSelectedStaffList((prev) => [
                              ...prev,
                              { staffId: staff.id, shiftId: "none" },
                            ]);
                          }
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-600/30 border border-emerald-500"
                            : "hover:bg-slate-700 border border-transparent"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-slate-500"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getAvatarUrl(staff.avatar)} />
                          <AvatarFallback
                            style={{ backgroundColor: staff.color }}
                            className="text-white text-xs"
                          >
                            {staff.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {staff.fullName}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">
                            {staff.position || "Personel"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Seçili Personeller ve Vardiya Seçimi */}
            {selectedStaffList.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">
                  Seçili Personeller ({selectedStaffList.length})
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-600 rounded-lg p-2">
                  {selectedStaffList.map(({ staffId, shiftId }) => {
                    const staff = allStaff.find((s) => s.id === staffId);
                    if (!staff) return null;
                    return (
                      <div
                        key={staffId}
                        className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getAvatarUrl(staff.avatar)} />
                          <AvatarFallback
                            style={{ backgroundColor: staff.color }}
                            className="text-white text-xs"
                          >
                            {staff.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {staff.fullName}
                          </p>
                        </div>
                        <Select
                          value={shiftId}
                          onValueChange={(value) => {
                            setSelectedStaffList((prev) =>
                              prev.map((s) =>
                                s.staffId === staffId
                                  ? { ...s, shiftId: value }
                                  : s
                              )
                            );
                          }}
                        >
                          <SelectTrigger className="w-32 h-8 bg-slate-600 border-slate-500 text-white text-xs">
                            <SelectValue placeholder="Vardiya" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            <SelectItem
                              value="none"
                              className="text-slate-400 text-xs"
                            >
                              Vardiya yok
                            </SelectItem>
                            {shifts.map((shift: any) => (
                              <SelectItem
                                key={shift.id}
                                value={shift.id}
                                className="text-white text-xs"
                              >
                                {shift.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => {
                            setSelectedStaffList((prev) =>
                              prev.filter((s) => s.staffId !== staffId)
                            );
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStaffAssignModal(false);
                setSelectedStaffList([]);
                setStaffSearchQuery("");
              }}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleAssignStaff}
              disabled={selectedStaffList.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {selectedStaffList.length} Personel Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ekibe Ata Modal */}
      <Dialog open={showTeamAssignModal} onOpenChange={setShowTeamAssignModal}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-400" />
              Ekibe Ata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seçili masalar */}
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Seçili Masalar</p>
              <div className="flex flex-wrap gap-1">
                {selectedTableIds.slice(0, 10).map((id) => {
                  const table = tables.find((t) => t.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="bg-slate-600 text-slate-200 text-xs"
                    >
                      {table?.label || id}
                    </Badge>
                  );
                })}
                {selectedTableIds.length > 10 && (
                  <Badge
                    variant="secondary"
                    className="bg-slate-600 text-slate-200 text-xs"
                  >
                    +{selectedTableIds.length - 10} daha
                  </Badge>
                )}
              </div>
            </div>

            {/* Ekip Seçimi */}
            <div className="space-y-2">
              <Label className="text-slate-300">Ekip Seç</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-600 rounded-lg p-2">
                {teams.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Henüz ekip oluşturulmamış
                  </p>
                ) : (
                  teams.map((team: any) => {
                    const leader = allStaff.find((s) => s.id === team.leaderId);
                    // Ekibe atanmış grupları bul
                    const teamGroups = tableGroups.filter(
                      (g) => g.assignedTeamId === team.id
                    );
                    // Ekibe ait tüm masa ID'lerini topla
                    const teamTableIds = teamGroups.flatMap((g) => g.tableIds);
                    const teamTableCount = teamTableIds.length;

                    // Ekibe ait masalara atanmış personelleri bul (unique)
                    const teamStaffIds = new Set<string>();
                    staffAssignments.forEach((assignment: any) => {
                      if (
                        assignment.tableIds?.some((tid: string) =>
                          teamTableIds.includes(tid)
                        )
                      ) {
                        teamStaffIds.add(assignment.staffId);
                      }
                    });
                    const teamMemberCount = teamStaffIds.size;

                    return (
                      <div
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedTeamId === team.id
                            ? "bg-purple-600/30 border border-purple-500"
                            : "hover:bg-slate-700 border border-transparent"
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {team.name}
                          </p>
                          {leader && (
                            <p className="text-xs text-slate-400 truncate">
                              Lider: {leader.fullName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {teamTableCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-purple-500/20 text-purple-300"
                            >
                              {teamTableCount} masa
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-600 text-slate-300"
                          >
                            {teamMemberCount} üye
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTeamAssignModal(false);
                setSelectedTeamId("");
              }}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleAssignToTeam}
              disabled={!selectedTeamId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Ekibe Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Şablon Kaydet Modal */}
      <Dialog
        open={showSaveTemplateModal}
        onOpenChange={setShowSaveTemplateModal}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Save className="h-5 w-5 text-emerald-400" />
              Şablon Olarak Kaydet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Şablon Adı</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Örn: Düğün Organizasyonu"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Açıklama (Opsiyonel)</Label>
              <Input
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Bu şablon hakkında kısa açıklama..."
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">
                Kaydedilecek Veriler:
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-300"
                >
                  {tableGroups.length} Masa Grubu
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/20 text-emerald-300"
                >
                  {staffAssignments.length} Personel Ataması
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveTemplateModal(false);
                setNewTemplateName("");
                setNewTemplateDescription("");
              }}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Şablon Yükle Modal */}
      <Dialog
        open={showLoadTemplateModal}
        onOpenChange={setShowLoadTemplateModal}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-400" />
              Şablon Yükle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <FileUp className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">Henüz kayıtlı şablon yok</p>
                <p className="text-xs text-slate-500 mt-1">
                  Mevcut organizasyonu şablon olarak kaydedin
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {templates.map((template: any) => (
                  <div
                    key={template.id}
                    className="p-3 rounded-lg border bg-slate-700/50 border-slate-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {template.name}
                          </p>
                          {template.isDefault && (
                            <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">
                              Varsayılan
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-600"
                          >
                            {template.tableGroups?.length || 0} grup
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-600"
                          >
                            {template.staffAssignments?.length || 0} atama
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplyTemplate(template.id)}
                          className="bg-blue-600 hover:bg-blue-700 h-8"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Uygula
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLoadTemplateModal(false)}
              className="border-slate-600 text-slate-300"
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Özel Görev Ata Modal */}
      <Dialog
        open={showSpecialTaskModal}
        onOpenChange={(open) => {
          setShowSpecialTaskModal(open);
          if (!open) {
            setSelectedStaffForTask([]);
            setSpecialTaskLocation("");
            setSpecialTaskSearchQuery("");
          }
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-amber-400" />
              Özel Görev Ata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Görev Yeri */}
            <div className="space-y-2">
              <Label className="text-slate-300">Görev Yeri</Label>
              <Input
                value={specialTaskLocation}
                onChange={(e) => setSpecialTaskLocation(e.target.value)}
                placeholder="Örn: Giriş Kapısı, Backstage, VIP Alan..."
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Personel Arama ve Seçim */}
            <div className="space-y-2">
              <Label className="text-slate-300">Personel Seç (Çoklu)</Label>
              <Input
                value={specialTaskSearchQuery}
                onChange={(e) => setSpecialTaskSearchQuery(e.target.value)}
                placeholder="İsim veya pozisyon ara..."
                className="bg-slate-700 border-slate-600 text-white"
              />
              <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-600 rounded-lg p-2">
                {filteredStaffForTask.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Personel bulunamadı
                  </p>
                ) : (
                  filteredStaffForTask.map((staff) => {
                    const isSelected = selectedStaffForTask.some(
                      (s) => s.staffId === staff.id
                    );
                    return (
                      <div
                        key={staff.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaffForTask((prev) =>
                              prev.filter((s) => s.staffId !== staff.id)
                            );
                          } else {
                            setSelectedStaffForTask((prev) => [
                              ...prev,
                              { staffId: staff.id, shiftId: "none" },
                            ]);
                          }
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-amber-600/30 border border-amber-500"
                            : "hover:bg-slate-700 border border-transparent"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "bg-amber-500 border-amber-500"
                              : "border-slate-500"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getAvatarUrl(staff.avatar)} />
                          <AvatarFallback
                            style={{ backgroundColor: staff.color }}
                            className="text-white text-xs"
                          >
                            {staff.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {staff.fullName}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">
                            {staff.position || "Personel"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Seçili Personeller ve Vardiya Seçimi */}
            {selectedStaffForTask.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">
                  Seçili Personeller ({selectedStaffForTask.length})
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-600 rounded-lg p-2">
                  {selectedStaffForTask.map(({ staffId, shiftId }) => {
                    const staff = allStaff.find((s) => s.id === staffId);
                    if (!staff) return null;
                    return (
                      <div
                        key={staffId}
                        className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getAvatarUrl(staff.avatar)} />
                          <AvatarFallback
                            style={{ backgroundColor: staff.color }}
                            className="text-white text-xs"
                          >
                            {staff.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {staff.fullName}
                          </p>
                        </div>
                        <Select
                          value={shiftId}
                          onValueChange={(value) => {
                            setSelectedStaffForTask((prev) =>
                              prev.map((s) =>
                                s.staffId === staffId
                                  ? { ...s, shiftId: value }
                                  : s
                              )
                            );
                          }}
                        >
                          <SelectTrigger className="w-36 h-8 bg-slate-600 border-slate-500 text-white text-xs">
                            <SelectValue placeholder="Vardiya seç" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            <SelectItem
                              value="none"
                              className="text-slate-400 text-xs"
                            >
                              Vardiya yok
                            </SelectItem>
                            {shifts.map((shift: any) => (
                              <SelectItem
                                key={shift.id}
                                value={shift.id}
                                className="text-white text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: shift.color }}
                                  />
                                  {shift.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => {
                            setSelectedStaffForTask((prev) =>
                              prev.filter((s) => s.staffId !== staffId)
                            );
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSpecialTaskModal(false);
                setSelectedStaffForTask([]);
                setSpecialTaskLocation("");
                setSpecialTaskSearchQuery("");
              }}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleAssignSpecialTask}
              disabled={
                selectedStaffForTask.length === 0 || !specialTaskLocation.trim()
              }
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Briefcase className="h-4 w-4 mr-1" />
              {selectedStaffForTask.length} Personele Görev Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grup Personel Detay Modal */}
      <Dialog
        open={showGroupStaffModal}
        onOpenChange={(open) => {
          setShowGroupStaffModal(open);
          if (!open) setSelectedGroupForStaff(null);
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              {selectedGroupForStaff?.name} - Atanmış Personeller
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedGroupForStaff &&
              (() => {
                const groupAssignments = getGroupStaffAssignments(
                  selectedGroupForStaff.id
                );

                if (groupAssignments.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-400">
                        Bu gruba henüz personel atanmamış
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Grubu seçip "Personel Ata" butonunu kullanın
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {groupAssignments.map((assignment: any) => {
                      const staff = allStaff.find(
                        (s) => s.id === assignment.staffId
                      );
                      const shift = shifts.find(
                        (sh: any) => sh.id === assignment.shiftId
                      );
                      if (!staff) return null;

                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-slate-700/50 border-slate-600"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getAvatarUrl(staff.avatar)} />
                            <AvatarFallback
                              style={{ backgroundColor: staff.color }}
                              className="text-white text-sm"
                            >
                              {staff.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {staff.fullName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400 capitalize">
                                {staff.position || "Personel"}
                              </span>
                              {shift && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                  style={{
                                    backgroundColor: `${shift.color}20`,
                                    color: shift.color,
                                    borderColor: `${shift.color}50`,
                                  }}
                                >
                                  {shift.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={async () => {
                              try {
                                await staffApi.removeStaffAssignment(
                                  assignment.id
                                );
                                setStaffAssignments((prev) =>
                                  prev.filter(
                                    (a: any) => a.id !== assignment.id
                                  )
                                );
                                setHasChanges(true);
                                showNotification(
                                  "success",
                                  `${staff.fullName} gruptan kaldırıldı`
                                );
                              } catch (error) {
                                console.error("Kaldırma hatası:", error);
                                showNotification(
                                  "error",
                                  "Personel kaldırılamadı"
                                );
                              }
                            }}
                            title="Personeli Kaldır"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGroupStaffModal(false);
                setSelectedGroupForStaff(null);
              }}
              className="border-slate-600 text-slate-300"
            >
              Kapat
            </Button>
            <Button
              onClick={() => {
                if (selectedGroupForStaff) {
                  setSelectedTableIds([...selectedGroupForStaff.tableIds]);
                  setShowGroupStaffModal(false);
                  setSelectedGroupForStaff(null);
                  setShowStaffAssignModal(true);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Personel Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atama Detay Modal */}
      <Dialog
        open={showAssignmentDetailModal}
        onOpenChange={(open) => {
          setShowAssignmentDetailModal(open);
          if (!open) {
            setSelectedAssignment(null);
            setEditingShiftId("none");
          }
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {selectedAssignment?.assignmentType === "special_task" ? (
                <>
                  <Briefcase className="h-5 w-5 text-amber-400" />
                  Özel Görev Detayları
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 text-emerald-400" />
                  Atama Detayları
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAssignment &&
            (() => {
              const staff = allStaff.find(
                (s) => s.id === selectedAssignment.staffId
              );
              const currentShift = shifts.find(
                (sh: any) => sh.id === editingShiftId
              );
              const isSpecialTask =
                selectedAssignment.assignmentType === "special_task";

              if (!staff) return null;

              return (
                <div className="space-y-4">
                  {/* Personel Bilgisi */}
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={getAvatarUrl(staff.avatar)} />
                      <AvatarFallback
                        style={{ backgroundColor: staff.color }}
                        className="text-white text-lg"
                      >
                        {staff.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {staff.fullName}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {staff.position || "Personel"}
                      </p>
                    </div>
                  </div>

                  {/* Görev Tipi */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Görev Tipi</Label>
                    <div className="p-2 bg-slate-700/50 rounded-lg">
                      {isSpecialTask ? (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-amber-400" />
                          <span className="text-sm text-amber-400">
                            Özel Görev
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sofa className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400">
                            Masa Ataması
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Özel Görev Yeri */}
                  {isSpecialTask && selectedAssignment.specialTaskLocation && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Görev Yeri</Label>
                      <div className="p-2 bg-slate-700/50 rounded-lg">
                        <span className="text-sm text-white">
                          {selectedAssignment.specialTaskLocation}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Atanan Masalar */}
                  {!isSpecialTask &&
                    selectedAssignment.tableIds?.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-slate-300">Atanan Masalar</Label>
                        <div className="flex flex-wrap gap-1 p-2 bg-slate-700/50 rounded-lg">
                          {selectedAssignment.tableIds
                            .slice(0, 15)
                            .map((tableId: string) => {
                              const table = tables.find(
                                (t) => t.id === tableId
                              );
                              return (
                                <Badge
                                  key={tableId}
                                  variant="secondary"
                                  className="bg-slate-600 text-slate-200 text-xs"
                                >
                                  {table?.label || tableId}
                                </Badge>
                              );
                            })}
                          {selectedAssignment.tableIds.length > 15 && (
                            <Badge
                              variant="secondary"
                              className="bg-slate-600 text-slate-200 text-xs"
                            >
                              +{selectedAssignment.tableIds.length - 15} daha
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Vardiya Seçimi */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Vardiya</Label>
                    <Select
                      value={editingShiftId}
                      onValueChange={setEditingShiftId}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Vardiya seç">
                          {currentShift ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: currentShift.color }}
                              />
                              {currentShift.name}
                            </div>
                          ) : (
                            <span className="text-slate-400">Vardiya yok</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="none" className="text-slate-400">
                          Vardiya yok
                        </SelectItem>
                        {shifts.map((shift: any) => (
                          <SelectItem
                            key={shift.id}
                            value={shift.id}
                            className="text-white"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: shift.color }}
                              />
                              {shift.name} ({shift.startTime} - {shift.endTime})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={handleDeleteAssignment}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Atamayı Kaldır
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignmentDetailModal(false);
                  setSelectedAssignment(null);
                }}
                className="border-slate-600 text-slate-300"
              >
                İptal
              </Button>
              <Button
                onClick={handleUpdateAssignmentShift}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="h-4 w-4 mr-1" />
                Kaydet
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personel Konum Görüntüleme Modal - Yerleşim Planı */}
      <Dialog
        open={showStaffLocationModal}
        onOpenChange={(open) => {
          setShowStaffLocationModal(open);
          if (!open) setSelectedStaffForLocation(null);
        }}
      >
        <DialogContent className="!max-w-[800px] bg-slate-800 border-slate-700 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-400" />
              {selectedStaffForLocation?.staff?.fullName} - Görev Konumu
            </DialogTitle>
          </DialogHeader>

          {selectedStaffForLocation && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Personel Bilgisi */}
              <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={getAvatarUrl(selectedStaffForLocation.staff?.avatar)}
                  />
                  <AvatarFallback
                    style={{
                      backgroundColor: selectedStaffForLocation.staff?.color,
                    }}
                    className="text-white text-lg"
                  >
                    {selectedStaffForLocation.staff?.fullName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {selectedStaffForLocation.staff?.fullName}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {selectedStaffForLocation.staff?.position || "Personel"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedStaffForLocation.assignedGroup && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${selectedStaffForLocation.assignedGroup.color}20`,
                        color: selectedStaffForLocation.assignedGroup.color,
                        borderColor: `${selectedStaffForLocation.assignedGroup.color}50`,
                      }}
                    >
                      {selectedStaffForLocation.assignedGroup.name}
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className="text-xs bg-slate-600 text-slate-300"
                  >
                    {selectedStaffForLocation.assignedTableIds?.length || 0}{" "}
                    masa
                  </Badge>
                </div>
              </div>

              {/* Mini Yerleşim Planı */}
              <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden relative min-h-[400px]">
                <div
                  className="absolute inset-0 overflow-auto"
                  style={{ padding: "20px" }}
                >
                  <div
                    style={{
                      width: CANVAS_WIDTH * 0.7,
                      height: CANVAS_HEIGHT * 0.7,
                      position: "relative",
                      transform: "scale(0.7)",
                      transformOrigin: "top left",
                    }}
                  >
                    {/* Stage Elements */}
                    {stageElements.map((element) => (
                      <div
                        key={element.id}
                        className="absolute select-none"
                        style={{
                          left: element.x,
                          top: element.y,
                          width: element.width,
                          height: element.height,
                        }}
                      >
                        <div
                          className={`w-full h-full rounded-lg flex items-center justify-center opacity-50 ${
                            element.type === "stage"
                              ? "bg-blue-600"
                              : element.type === "system_control"
                              ? "bg-amber-600"
                              : "bg-purple-500"
                          }`}
                        >
                          <span className="text-xs font-medium text-white">
                            {element.label}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Tüm Masalar - Atanmış olanlar renkli, diğerleri gri */}
                    {normalTables.map((table) => {
                      const isAssignedToThisStaff =
                        selectedStaffForLocation.assignedTableIds?.includes(
                          table.id
                        );
                      const staffColor =
                        selectedStaffForLocation.staff?.color || "#10b981";
                      const groupColor =
                        selectedStaffForLocation.assignedGroup?.color ||
                        staffColor;

                      return (
                        <div
                          key={table.id}
                          className="absolute select-none"
                          style={{
                            left: table.x,
                            top: table.y,
                          }}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2 transition-all ${
                              isAssignedToThisStaff
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-125 z-10"
                                : "opacity-30"
                            }`}
                            style={{
                              backgroundColor: isAssignedToThisStaff
                                ? groupColor
                                : "#4b5563",
                              borderColor: isAssignedToThisStaff
                                ? "#10b981"
                                : "#6b7280",
                            }}
                          >
                            <span
                              className={`text-[9px] font-bold ${
                                isAssignedToThisStaff
                                  ? "text-white"
                                  : "text-slate-400"
                              }`}
                            >
                              {table.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Localar */}
                    {locaTables.map((loca) => {
                      const isAssignedToThisStaff =
                        selectedStaffForLocation.assignedTableIds?.includes(
                          loca.id
                        );
                      const groupColor =
                        selectedStaffForLocation.assignedGroup?.color ||
                        "#ec4899";

                      return (
                        <div
                          key={loca.id}
                          className="absolute select-none"
                          style={{
                            left: loca.x,
                            top: loca.y,
                          }}
                        >
                          <div
                            className={`rounded-lg flex flex-col items-center justify-center text-white shadow-lg border transition-all ${
                              isAssignedToThisStaff
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 z-10"
                                : "opacity-30"
                            }`}
                            style={{
                              width: LOCA_WIDTH,
                              height: LOCA_HEIGHT,
                              backgroundColor: isAssignedToThisStaff
                                ? groupColor
                                : "#4b5563",
                              borderColor: isAssignedToThisStaff
                                ? "#10b981"
                                : "#6b7280",
                            }}
                          >
                            <Sofa
                              className={`w-3 h-3 ${
                                isAssignedToThisStaff
                                  ? "text-white"
                                  : "text-slate-400"
                              }`}
                            />
                            <span
                              className={`text-[9px] font-bold ${
                                isAssignedToThisStaff
                                  ? "text-white"
                                  : "text-slate-400"
                              }`}
                            >
                              {loca.locaName || loca.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="absolute bottom-3 left-3 bg-slate-800/90 rounded-lg p-2 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-emerald-500"
                      style={{
                        backgroundColor:
                          selectedStaffForLocation.assignedGroup?.color ||
                          selectedStaffForLocation.staff?.color ||
                          "#10b981",
                      }}
                    />
                    <span className="text-slate-300">Atanmış Masalar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-gray-600 opacity-50" />
                    <span className="text-slate-400">Diğer Masalar</span>
                  </div>
                </div>
              </div>

              {/* Atanmış Masa Listesi */}
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">Atanmış Masalar:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedStaffForLocation.assignedTableIds
                    ?.slice(0, 20)
                    .map((tableId: string) => {
                      const table = tables.find((t) => t.id === tableId);
                      return (
                        <Badge
                          key={tableId}
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: `${
                              selectedStaffForLocation.assignedGroup?.color ||
                              selectedStaffForLocation.staff?.color ||
                              "#10b981"
                            }30`,
                            color:
                              selectedStaffForLocation.assignedGroup?.color ||
                              selectedStaffForLocation.staff?.color ||
                              "#10b981",
                          }}
                        >
                          {table?.label || tableId}
                        </Badge>
                      );
                    })}
                  {selectedStaffForLocation.assignedTableIds?.length > 20 && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-slate-600 text-slate-300"
                    >
                      +{selectedStaffForLocation.assignedTableIds.length - 20}{" "}
                      daha
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStaffLocationModal(false);
                setSelectedStaffForLocation(null);
              }}
              className="border-slate-600 text-slate-300"
            >
              Kapat
            </Button>
            <Button
              onClick={() => {
                // Detay modalına geç
                if (selectedStaffForLocation) {
                  setShowStaffLocationModal(false);
                  openAssignmentDetail(selectedStaffForLocation);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Edit className="h-4 w-4 mr-1" />
              Düzenle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
