"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Save,
  Wand2,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Camera,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { eventsApi, staffApi, uploadApi, API_BASE } from "@/lib/api";

// shadcn components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type StaffPosition = "supervizor" | "sef" | "garson" | "komi";

const POSITION_LABELS: Record<StaffPosition, string> = {
  supervizor: "Süpervizör",
  sef: "Şef",
  garson: "Garson",
  komi: "Komi",
};

interface Staff {
  id: string;
  fullName: string;
  email: string;
  color: string;
  position?: StaffPosition;
  avatar?: string;
}

interface TableData {
  id: string;
  label: string;
  x: number;
  y: number;
  typeName?: string;
  type?: string;
  color?: string; // Masa tipinin rengi
}

interface Assignment {
  staffId: string;
  staffName: string;
  staffColor: string;
  tableIds: string[];
}

// Servis Ekibi yapısı
interface ServiceTeam {
  id: string;
  name: string;
  color: string;
  members: Staff[];
  leaderId?: string; // Şef ID'si
  tableIds: string[];
}

// Rol kuralları
const ROLE_RULES = {
  supervizor: { canBeInMultipleTeams: true, canLead: true },
  sef: { canBeInMultipleTeams: true, canLead: true },
  garson: { canBeInMultipleTeams: false, canLead: false },
  komi: { canBeInMultipleTeams: false, canLead: false },
};

// Pozisyon renkleri
const POSITION_COLORS: Record<StaffPosition, string> = {
  supervizor: "bg-red-500/20 text-red-400 border-red-500/30",
  sef: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  garson: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  komi: "bg-green-500/20 text-green-400 border-green-500/30",
};

// Masa tipi renkleri - farklı varyasyonları da destekle
const TABLE_TYPE_COLORS: Record<string, string> = {
  // Yuvarlak
  yuvarlak: "#3b82f6",
  "yuvarlak masa": "#3b82f6",
  round: "#3b82f6",
  circle: "#3b82f6",
  // Kare
  kare: "#22c55e",
  "kare masa": "#22c55e",
  square: "#22c55e",
  // Dikdörtgen
  dikdörtgen: "#f59e0b",
  "dikdörtgen masa": "#f59e0b",
  rectangle: "#f59e0b",
  rectangular: "#f59e0b",
  // Oval
  oval: "#8b5cf6",
  "oval masa": "#8b5cf6",
  ellipse: "#8b5cf6",
  // Kokteyl
  kokteyl: "#ec4899",
  "kokteyl masa": "#ec4899",
  cocktail: "#ec4899",
  highboy: "#ec4899",
  // VIP
  vip: "#ef4444",
  "vip masa": "#ef4444",
  // Bar
  bar: "#06b6d4",
  "bar masa": "#06b6d4",
  // Loca
  loca: "#f97316",
  booth: "#f97316",
  // Standart - Turkuaz renk verelim ki görünsün
  standart: "#14b8a6",
  standard: "#14b8a6",
  normal: "#14b8a6",
  default: "#14b8a6",
};

interface EventData {
  id: string;
  name: string;
  eventDate: string;
  venueLayout?: {
    tables: TableData[];
    dimensions?: { width: number; height: number };
  };
}

// Avatar URL helper
const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

export default function StaffOrganizationPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showQuickTeamModal, setShowQuickTeamModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Drag selection state'leri
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  // Context menu state'leri
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tableIds: string[];
    assignedTeam?: ServiceTeam; // Eğer seçili masalar bir ekibe aitse
  } | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [showQuickCreateTeamModal, setShowQuickCreateTeamModal] =
    useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState<
    string | null
  >(null);

  // Bildirim state'i
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  // Bildirim göster helper
  const showNotification = (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string
  ) => {
    setNotification({ type, title, message });
    // 5 saniye sonra otomatik kapat
    setTimeout(() => setNotification(null), 5000);
  };
  const [editingTeam, setEditingTeam] = useState<ServiceTeam | null>(null);

  // Seçili ekip
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  // Personelin hangi ekiplerde olduğunu bul
  const getStaffTeams = (staffId: string): ServiceTeam[] => {
    return teams.filter((t) => t.members.some((m) => m.id === staffId));
  };

  // Personel ekibe eklenebilir mi kontrol et
  const canAddToTeam = (staff: Staff, teamId: string): boolean => {
    if (!staff.position) return true;
    const rules = ROLE_RULES[staff.position];
    const currentTeams = getStaffTeams(staff.id);

    // Zaten bu ekipte mi?
    if (currentTeams.some((t) => t.id === teamId)) return false;

    // Birden fazla ekipte olamıyorsa ve başka ekipte varsa
    if (!rules.canBeInMultipleTeams && currentTeams.length > 0) return false;

    return true;
  };
  const [hasChanges, setHasChanges] = useState(false);

  // Yeni ekip oluştur
  const createTeam = (
    name: string,
    color: string,
    members: Staff[],
    leaderId?: string
  ) => {
    // Otomatik lider belirleme
    let finalLeaderId = leaderId;
    if (!finalLeaderId && members.length > 0) {
      // 1. Süpervizör varsa o lider
      const supervisor = members.find((m) => m.position === "supervizor");
      if (supervisor) {
        finalLeaderId = supervisor.id;
      } else {
        // 2. Şef varsa o lider
        const sef = members.find((m) => m.position === "sef");
        if (sef) {
          finalLeaderId = sef.id;
        } else if (members.length === 1) {
          // 3. Tek kişi varsa o lider
          finalLeaderId = members[0].id;
        }
        // 4. Birden fazla kişi var ama süpervizör/şef yok - lider seçilmeli (undefined kalır)
      }
    }

    const newTeam: ServiceTeam = {
      id: `team-${Date.now()}`,
      name,
      color,
      members,
      leaderId: finalLeaderId,
      tableIds: [],
    };
    setTeams((prev) => [...prev, newTeam]);
    setHasChanges(true);
    return newTeam;
  };

  // Ekibe üye ekle
  const addMemberToTeam = (teamId: string, staff: Staff) => {
    if (!canAddToTeam(staff, teamId)) return false;

    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, members: [...t.members, staff] } : t
      )
    );
    setHasChanges(true);
    return true;
  };

  // Ekipten üye çıkar
  const removeMemberFromTeam = (teamId: string, staffId: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              members: t.members.filter((m) => m.id !== staffId),
              leaderId: t.leaderId === staffId ? undefined : t.leaderId,
            }
          : t
      )
    );
    setHasChanges(true);
  };

  // Ekibe masa ata
  const assignTablesToTeam = (teamId: string, tableIds: string[]) => {
    // Önce bu masaları diğer ekiplerden kaldır
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        tableIds:
          t.id === teamId
            ? [...new Set([...t.tableIds, ...tableIds])]
            : t.tableIds.filter((id) => !tableIds.includes(id)),
      }))
    );
    setSelectedTableIds([]);
    setHasChanges(true);
  };

  // Ekibi sil
  const deleteTeam = (teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    if (selectedTeamId === teamId) setSelectedTeamId(null);
    setHasChanges(true);
  };

  // Masa için atanmış ekibi bul
  const getTableTeam = useCallback(
    (tableId: string): ServiceTeam | undefined => {
      return teams.find((t) => t.tableIds.includes(tableId));
    },
    [teams]
  );

  // Personel listesini yenile
  const reloadStaffList = async () => {
    try {
      const staffRes = await staffApi.getAll(true);
      if (staffRes.data?.length > 0) {
        setStaffList(staffRes.data);
      }
    } catch (error) {
      console.error("Personel listesi yüklenemedi:", error);
    }
  };

  // Veri yükle
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Etkinlik bilgisi
        const eventRes = await eventsApi.getOne(eventId);
        setEvent(eventRes.data);

        // Personel listesi
        try {
          const staffRes = await staffApi.getAll(true);
          if (staffRes.data?.length > 0) {
            setStaffList(staffRes.data);
          } else {
            // Mock data
            setStaffList([
              {
                id: "1",
                fullName: "Ahmet Yılmaz",
                email: "ahmet@staff.com",
                color: "#ef4444",
                position: "sef",
              },
              {
                id: "2",
                fullName: "Ayşe Demir",
                email: "ayse@staff.com",
                color: "#22c55e",
                position: "garson",
              },
              {
                id: "3",
                fullName: "Mehmet Kaya",
                email: "mehmet@staff.com",
                color: "#3b82f6",
                position: "garson",
              },
              {
                id: "4",
                fullName: "Fatma Şahin",
                email: "fatma@staff.com",
                color: "#eab308",
                position: "komi",
              },
            ]);
          }
        } catch {
          setStaffList([
            {
              id: "1",
              fullName: "Ahmet Yılmaz",
              email: "ahmet@staff.com",
              color: "#ef4444",
              position: "sef",
            },
            {
              id: "2",
              fullName: "Ayşe Demir",
              email: "ayse@staff.com",
              color: "#22c55e",
              position: "garson",
            },
            {
              id: "3",
              fullName: "Mehmet Kaya",
              email: "mehmet@staff.com",
              color: "#3b82f6",
              position: "garson",
            },
            {
              id: "4",
              fullName: "Fatma Şahin",
              email: "fatma@staff.com",
              color: "#eab308",
              position: "komi",
            },
          ]);
        }

        // Mevcut atamalar
        try {
          const assignRes = await staffApi.getEventAssignments(eventId);
          if (assignRes.data?.length > 0) {
            setAssignments(
              assignRes.data.map((a: any) => ({
                staffId: a.staffId,
                staffName: a.staffName,
                staffColor: a.staffColor,
                tableIds: a.assignedTableIds || [],
              }))
            );
          }
        } catch {
          // Atama yok
        }

        // Mevcut ekipleri yükle
        try {
          const teamsRes = await staffApi.getEventTeams(eventId);
          if (teamsRes.data?.length > 0) {
            setTeams(teamsRes.data);
          }
        } catch {
          // Ekip yok
        }
      } catch (error) {
        console.error("Veri yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  // Masaları filtrele (loca hariç)
  const tables = (event?.venueLayout?.tables || []).filter(
    (t) => t.typeName?.toLowerCase() !== "loca" && t.type !== "loca"
  );

  // Masa için atanmış personeli bul
  const getTableStaff = useCallback(
    (tableId: string): Assignment | undefined => {
      return assignments.find((a) => a.tableIds.includes(tableId));
    },
    [assignments]
  );

  // Atanmamış masalar (ekip bazlı)
  const unassignedTables = tables.filter((t) => !getTableTeam(t.id));

  // Personele masa ata
  const assignTablesToStaff = (staffId: string, tableIds: string[]) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setAssignments((prev) => {
      // Önce bu masaları diğer personellerden kaldır
      let updated = prev.map((a) => ({
        ...a,
        tableIds: a.tableIds.filter((id) => !tableIds.includes(id)),
      }));

      // Mevcut atamayı bul veya yeni oluştur
      const existing = updated.find((a) => a.staffId === staffId);
      if (existing) {
        existing.tableIds = [...new Set([...existing.tableIds, ...tableIds])];
      } else {
        updated.push({
          staffId,
          staffName: staff.fullName,
          staffColor: staff.color,
          tableIds,
        });
      }

      // Boş atamaları temizle
      return updated.filter((a) => a.tableIds.length > 0);
    });

    setSelectedTableIds([]);
    setHasChanges(true);
  };

  // Masadan atamayı kaldır
  const removeTableFromStaff = (tableId: string) => {
    setAssignments((prev) =>
      prev
        .map((a) => ({
          ...a,
          tableIds: a.tableIds.filter((id) => id !== tableId),
        }))
        .filter((a) => a.tableIds.length > 0)
    );
    setHasChanges(true);
  };

  // Otomatik atama
  const handleAutoAssign = async (strategy: "balanced" | "zone" | "random") => {
    if (staffList.length === 0) {
      showNotification("warning", "Uyarı", "Önce personel eklemelisiniz");
      return;
    }

    try {
      const response = await staffApi.autoAssign(eventId, {
        staffIds: staffList.map((s) => s.id),
        strategy,
      });

      if (response.data) {
        const newAssignments: Assignment[] = response.data
          .filter((a: any) => a.tableIds.length > 0)
          .map((a: any) => {
            const staff = staffList.find((s) => s.id === a.staffId);
            return {
              staffId: a.staffId,
              staffName: staff?.fullName || "Bilinmeyen",
              staffColor: staff?.color || "#3b82f6",
              tableIds: a.tableIds,
            };
          });
        setAssignments(newAssignments);
        setHasChanges(true);
      }
    } catch (error) {
      // Fallback: Local otomatik atama
      const tablesPerStaff = Math.ceil(tables.length / staffList.length);
      const newAssignments: Assignment[] = [];
      let tableIndex = 0;

      staffList.forEach((staff) => {
        const staffTables: string[] = [];
        for (let i = 0; i < tablesPerStaff && tableIndex < tables.length; i++) {
          staffTables.push(tables[tableIndex].id);
          tableIndex++;
        }
        if (staffTables.length > 0) {
          newAssignments.push({
            staffId: staff.id,
            staffName: staff.fullName,
            staffColor: staff.color,
            tableIds: staffTables,
          });
        }
      });

      setAssignments(newAssignments);
      setHasChanges(true);
    }
  };

  // Tüm atamaları temizle
  const clearAllAssignments = () => {
    setAssignments([]);
    setTeams([]);
    setHasChanges(true);
    setShowClearConfirm(false);
    showNotification(
      "success",
      "Temizlendi",
      "Tüm atamalar ve ekipler silindi"
    );
  };

  // Akıllı Otomatik Ekip Oluşturma - Masa tiplerine göre ayrı ekipler
  const handleSmartAutoAssign = () => {
    if (staffList.length === 0) {
      showNotification("warning", "Uyarı", "Önce personel eklemelisiniz");
      return;
    }

    // Personeli pozisyonlarına göre grupla
    const supervisors = [
      ...staffList.filter((s) => s.position === "supervizor"),
    ];
    const chefs = [...staffList.filter((s) => s.position === "sef")];
    const waiters = [...staffList.filter((s) => s.position === "garson")];
    const komis = [...staffList.filter((s) => s.position === "komi")];

    // Canvas ortasını bul (sahne genelde ortada)
    const canvasWidth = event?.venueLayout?.dimensions?.width || 1100;
    const centerX = canvasWidth / 2;

    // Masaları tip ve bölgeye göre grupla
    // Bölge: Sol (x < centerX) veya Sağ (x >= centerX)
    interface TableGroup {
      typeName: string;
      zone: "sol" | "sag";
      tables: typeof tables;
    }

    const tableGroups: TableGroup[] = [];

    tables.forEach((table) => {
      const typeName = table.typeName || "Standart";
      const zone = table.x < centerX ? "sol" : "sag";

      let group = tableGroups.find(
        (g) => g.typeName === typeName && g.zone === zone
      );
      if (!group) {
        group = { typeName, zone, tables: [] };
        tableGroups.push(group);
      }
      group.tables.push(table);
    });

    // Grupları sırala: VIP önce, sonra diğerleri
    tableGroups.sort((a, b) => {
      const aVip = a.typeName.toLowerCase().includes("vip") ? 0 : 1;
      const bVip = b.typeName.toLowerCase().includes("vip") ? 0 : 1;
      if (aVip !== bVip) return aVip - bVip;
      return a.zone.localeCompare(b.zone);
    });

    const newTeams: ServiceTeam[] = [];
    let teamIndex = 0;

    // Her grup için ekip oluştur
    tableGroups.forEach((group) => {
      const { typeName, zone, tables: groupTables } = group;
      const isVip = typeName.toLowerCase().includes("vip");

      // Bu grup için kaç ekip gerekiyor?
      const maxTablesPerTeam = isVip ? 15 : 25;
      const teamsNeeded = Math.ceil(groupTables.length / maxTablesPerTeam);

      for (let i = 0; i < teamsNeeded; i++) {
        // Lider seç
        let leader: Staff | undefined;

        if (isVip && supervisors.length > 0) {
          leader = supervisors.shift();
        } else if (chefs.length > 0) {
          leader = chefs.shift();
        } else if (supervisors.length > 0) {
          leader = supervisors.shift();
        } else if (waiters.length > 0) {
          leader = waiters.shift();
        }

        if (!leader) continue;

        const teamMembers: Staff[] = [leader];
        const teamColor =
          leader.color || `hsl(${(teamIndex * 50) % 360}, 70%, 50%)`;

        // Bu ekibe düşen masalar
        const startIdx = i * maxTablesPerTeam;
        const endIdx = Math.min(
          startIdx + maxTablesPerTeam,
          groupTables.length
        );
        const teamTableIds = groupTables
          .slice(startIdx, endIdx)
          .map((t) => t.id);
        const tableCount = teamTableIds.length;

        // Garson ekle (her 6 masa için 1)
        const waitersNeeded = Math.ceil(tableCount / 6);
        for (let w = 0; w < waitersNeeded && waiters.length > 0; w++) {
          teamMembers.push(waiters.shift()!);
        }

        // Komi ekle (her 10 masa için 1)
        const komisNeeded = Math.ceil(tableCount / 10);
        for (let k = 0; k < komisNeeded && komis.length > 0; k++) {
          teamMembers.push(komis.shift()!);
        }

        // Ekip adı - bölge bilgisi ile
        const zoneName = zone === "sol" ? "Sol" : "Sağ";
        let teamName: string;
        if (isVip) {
          teamName =
            teamsNeeded > 1 ? `VIP ${zoneName} ${i + 1}` : `VIP ${zoneName}`;
        } else {
          teamName =
            teamsNeeded > 1
              ? `${typeName} ${zoneName} ${i + 1}`
              : `${typeName} ${zoneName}`;
        }

        const newTeam: ServiceTeam = {
          id: `team-${Date.now()}-${teamIndex}`,
          name: teamName,
          color: teamColor,
          members: teamMembers,
          leaderId: leader.id,
          tableIds: teamTableIds,
        };

        newTeams.push(newTeam);
        teamIndex++;
      }
    });

    // Kalan personeli ekiplere dağıt
    let idx = 0;
    while (waiters.length > 0 && newTeams.length > 0) {
      newTeams[idx % newTeams.length].members.push(waiters.shift()!);
      idx++;
    }
    while (komis.length > 0 && newTeams.length > 0) {
      newTeams[idx % newTeams.length].members.push(komis.shift()!);
      idx++;
    }

    setTeams(newTeams);
    setHasChanges(true);

    // Özet bilgi
    const summary = tableGroups
      .map(
        (g) =>
          `${g.typeName} ${g.zone === "sol" ? "Sol" : "Sağ"}: ${
            g.tables.length
          }`
      )
      .join(", ");
    showNotification(
      "success",
      "Ekipler Oluşturuldu",
      `${newTeams.length} ekip oluşturuldu! ${summary} - Toplam: ${tables.length} masa`
    );
  };

  // Kaydet
  const handleSave = async () => {
    setSaving(true);
    try {
      // Personel atamalarını kaydet
      await staffApi.saveAssignments(
        eventId,
        assignments.map((a) => ({
          staffId: a.staffId,
          tableIds: a.tableIds,
          color: a.staffColor,
        }))
      );

      // Ekipleri kaydet
      await staffApi.saveEventTeams(
        eventId,
        teams.map((t) => ({
          name: t.name,
          color: t.color,
          members: t.members,
          leaderId: t.leaderId,
          tableIds: t.tableIds,
        }))
      );

      setHasChanges(false);
      showNotification(
        "success",
        "Başarılı",
        "Atamalar ve ekipler kaydedildi!"
      );
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      showNotification(
        "error",
        "Hata",
        "Kaydetme başarısız. Lütfen tekrar deneyin."
      );
    } finally {
      setSaving(false);
    }
  };

  // Masa tıklama
  const handleTableClick = (tableId: string, e: React.MouseEvent) => {
    // Context menu'yü kapat
    setContextMenu(null);

    if (e.ctrlKey || e.metaKey) {
      // Çoklu seçim
      setSelectedTableIds((prev) =>
        prev.includes(tableId)
          ? prev.filter((id) => id !== tableId)
          : [...prev, tableId]
      );
    } else {
      // Tek seçim
      setSelectedTableIds([tableId]);
    }
  };

  // Sağ tık context menu
  const handleContextMenu = (e: React.MouseEvent, tableId?: string) => {
    e.preventDefault();

    // Eğer bir masaya sağ tıklandıysa ve seçili değilse, onu seç
    if (tableId && !selectedTableIds.includes(tableId)) {
      setSelectedTableIds([tableId]);
    }

    // Seçili masa varsa context menu göster
    const tableIds =
      tableId && !selectedTableIds.includes(tableId)
        ? [tableId]
        : selectedTableIds;

    if (tableIds.length > 0) {
      // Seçili masaların hepsinin aynı ekibe ait olup olmadığını kontrol et
      const tableTeams = tableIds.map((id) =>
        teams.find((t) => t.tableIds.includes(id))
      );
      const uniqueTeams = [...new Set(tableTeams.filter(Boolean))];
      const assignedTeam =
        uniqueTeams.length === 1 ? uniqueTeams[0] : undefined;

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        tableIds,
        assignedTeam,
      });
    }
  };

  // Context menu'yü kapat
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Süpervizör ata
  const assignSupervisor = (supervisorId: string) => {
    if (!contextMenu) return;

    const supervisor = staffList.find((s) => s.id === supervisorId);
    if (!supervisor) return;

    // Yeni ekip oluştur ve süpervizörü lider yap
    const teamName = `Süpervizör ${supervisor.fullName.split(" ")[0]} Ekibi`;
    const teamColor = supervisor.color || "#8b5cf6";

    const newTeam: ServiceTeam = {
      id: `team-${Date.now()}`,
      name: teamName,
      color: teamColor,
      members: [supervisor],
      leaderId: supervisorId,
      tableIds: contextMenu.tableIds,
    };

    // Diğer ekiplerden bu masaları kaldır
    setTeams((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        tableIds: t.tableIds.filter((id) => !contextMenu.tableIds.includes(id)),
      }));
      return [...updated, newTeam];
    });

    setHasChanges(true);
    setContextMenu(null);
    setSelectedTableIds([]);
  };

  // Hızlı ekip oluştur (seçili masalarla)
  const quickCreateTeam = (name: string, color: string, leaderId?: string) => {
    if (!contextMenu && selectedTableIds.length === 0) return;

    const tableIds = contextMenu?.tableIds || selectedTableIds;
    const leader = leaderId
      ? staffList.find((s) => s.id === leaderId)
      : undefined;

    const newTeam: ServiceTeam = {
      id: `team-${Date.now()}`,
      name,
      color,
      members: leader ? [leader] : [],
      leaderId,
      tableIds,
    };

    // Diğer ekiplerden bu masaları kaldır
    setTeams((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        tableIds: t.tableIds.filter((id) => !tableIds.includes(id)),
      }));
      return [...updated, newTeam];
    });

    setHasChanges(true);
    setContextMenu(null);
    setSelectedTableIds([]);
    setShowQuickCreateTeamModal(false);
  };

  // Mevcut ekibe ata
  const assignToExistingTeam = (teamId: string) => {
    if (!contextMenu) return;

    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        tableIds:
          t.id === teamId
            ? [...new Set([...t.tableIds, ...contextMenu.tableIds])]
            : t.tableIds.filter((id) => !contextMenu.tableIds.includes(id)),
      }))
    );

    setHasChanges(true);
    setContextMenu(null);
    setSelectedTableIds([]);
  };

  // Ekipten masaları çıkar
  const removeTablesFromTeam = (teamId: string, tableIdsToRemove: string[]) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              tableIds: t.tableIds.filter(
                (id) => !tableIdsToRemove.includes(id)
              ),
            }
          : t
      )
    );
    setHasChanges(true);
    setContextMenu(null);
    setSelectedTableIds([]);
  };

  // Otomatik lider belirle
  const determineAutoLeader = (members: Staff[]): string | undefined => {
    // 1. Süpervizör varsa o lider
    const supervisor = members.find((m) => m.position === "supervizor");
    if (supervisor) return supervisor.id;

    // 2. Şef varsa o lider
    const sef = members.find((m) => m.position === "sef");
    if (sef) return sef.id;

    // 3. Tek kişi varsa o lider
    if (members.length === 1) return members[0].id;

    // 4. Birden fazla kişi var ama süpervizör/şef yok - lider seçilmeli
    return undefined;
  };

  // Ekibe üye ekle
  const addMemberToTeamById = (teamId: string, staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        // Zaten ekipte mi kontrol et
        if (t.members.some((m) => m.id === staffId)) return t;

        const newMembers = [...t.members, staff];
        const newLeaderId = determineAutoLeader(newMembers);

        return {
          ...t,
          members: newMembers,
          leaderId: newLeaderId,
        };
      })
    );
    setHasChanges(true);
  };

  // Ekipten üye çıkar
  const removeMemberFromTeamById = (teamId: string, staffId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          members: t.members.filter((m) => m.id !== staffId),
          leaderId: t.leaderId === staffId ? undefined : t.leaderId,
        };
      })
    );
    setHasChanges(true);
  };

  // Ekip liderini değiştir
  const changeTeamLeader = (teamId: string, newLeaderId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, leaderId: newLeaderId } : t))
    );
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Bildirim Alert */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
          <Alert
            variant={
              notification.type === "error"
                ? "destructive"
                : notification.type === "success"
                ? "success"
                : notification.type === "warning"
                ? "warning"
                : "info"
            }
            onClose={() => setNotification(null)}
          >
            <AlertTitle>{notification.title}</AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${eventId}`}
              className="p-2 bg-slate-800 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Servis Ekibi Organizasyonu
              </h1>
              <p className="text-sm text-slate-400">{event?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Kaydedilmemiş değişiklikler
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sol Panel - Ekipler ve Personel */}
        {showLeftPanel ? (
          <div className="w-72 flex-shrink-0 border-r border-slate-800 flex">
            <div className="flex-1 flex flex-col">
              {/* Ekipler Bölümü */}
              <div className="p-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-sm">Servis Ekipleri</h2>
                  <button
                    onClick={() => setShowCreateTeamModal(true)}
                    className="text-xs px-2 py-1 bg-purple-600 rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Ekip Oluştur
                  </button>
                </div>
              </div>

              {/* Ekip Listesi */}
              <div className="flex-1 overflow-y-auto">
                {teams.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Henüz ekip oluşturulmadı</p>
                    <button
                      onClick={() => setShowCreateTeamModal(true)}
                      className="mt-2 text-purple-400"
                    >
                      İlk ekibi oluştur
                    </button>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {teams.map((team) => {
                      const isSelected = selectedTeamId === team.id;
                      const leader = team.members.find(
                        (m) => m.id === team.leaderId
                      );

                      return (
                        <div
                          key={team.id}
                          className={`rounded-lg overflow-hidden border ${
                            isSelected
                              ? "border-purple-500"
                              : "border-slate-700"
                          }`}
                        >
                          {/* Ekip Başlığı */}
                          <button
                            onClick={() =>
                              setSelectedTeamId(isSelected ? null : team.id)
                            }
                            className={`w-full p-3 text-left ${
                              isSelected ? "bg-purple-600/20" : "bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: team.color }}
                              />
                              <span className="font-medium flex-1">
                                {team.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                {team.tableIds.length} masa
                              </span>
                            </div>
                            {leader && (
                              <div className="text-xs text-amber-400 mt-1">
                                Şef: {leader.fullName}
                              </div>
                            )}
                          </button>

                          {/* Ekip Üyeleri (seçiliyse göster) */}
                          {isSelected && (
                            <div className="bg-slate-800/50 p-2 space-y-1">
                              {team.members.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-2 p-2 bg-slate-700/50 rounded"
                                >
                                  <Avatar className="w-7 h-7">
                                    <AvatarImage
                                      src={getAvatarUrl(member.avatar)}
                                    />
                                    <AvatarFallback
                                      style={{ backgroundColor: member.color }}
                                      className="text-xs"
                                    >
                                      {member.fullName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">
                                      {member.fullName}
                                    </p>
                                  </div>
                                  {member.position && (
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded border ${
                                        POSITION_COLORS[member.position]
                                      }`}
                                    >
                                      {POSITION_LABELS[member.position]}
                                    </span>
                                  )}
                                  {member.id === team.leaderId && (
                                    <span className="text-xs text-amber-400">
                                      ★
                                    </span>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  /* Üye ekle modal */
                                }}
                                className="w-full p-2 text-xs text-slate-400 border border-dashed border-slate-600 rounded"
                              >
                                + Üye Ekle
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Personel Havuzu */}
              <div className="border-t border-slate-800">
                <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-400">
                    Personel Havuzu
                  </h3>
                  <button
                    onClick={() => setShowAddStaffModal(true)}
                    className="text-xs text-purple-400"
                  >
                    + Ekle
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {staffList.map((staff) => {
                    const staffTeams = getStaffTeams(staff.id);
                    const isAvailable = staff.position
                      ? ROLE_RULES[staff.position].canBeInMultipleTeams ||
                        staffTeams.length === 0
                      : true;

                    return (
                      <div
                        key={staff.id}
                        draggable={isAvailable}
                        className={`flex items-center gap-2 p-2 rounded text-sm ${
                          isAvailable
                            ? "bg-slate-800 cursor-grab"
                            : "bg-slate-800/50 opacity-50"
                        }`}
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={getAvatarUrl(staff.avatar)} />
                          <AvatarFallback
                            style={{ backgroundColor: staff.color }}
                            className="text-xs"
                          >
                            {staff.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">
                          {staff.fullName}
                        </span>
                        {staff.position && (
                          <span
                            className={`text-xs px-1 py-0.5 rounded ${
                              POSITION_COLORS[staff.position]
                            }`}
                          >
                            {POSITION_LABELS[staff.position].charAt(0)}
                          </span>
                        )}
                        {staffTeams.length > 0 && (
                          <span className="text-xs text-slate-500">
                            {staffTeams.length} ekip
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seçili ekibe masa atama */}
              {selectedTeamId && selectedTableIds.length > 0 && (
                <div className="p-3 border-t border-slate-800">
                  <button
                    onClick={() =>
                      assignTablesToTeam(selectedTeamId, selectedTableIds)
                    }
                    className="w-full py-2 bg-purple-600 rounded-lg font-medium text-sm"
                  >
                    {selectedTableIds.length} Masayı Ekibe Ata
                  </button>
                </div>
              )}
            </div>
            {/* Sol Panel Toggle Butonu - İç kısımda */}
            <button
              onClick={() => setShowLeftPanel(false)}
              className="flex-shrink-0 w-6 bg-slate-700/50 border-l border-slate-700 flex items-center justify-center group"
              title="Paneli Gizle"
            >
              <PanelLeftClose className="w-4 h-4 text-slate-500 group-hover:text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLeftPanel(true)}
            className="flex-shrink-0 w-6 bg-slate-800 border-r border-slate-700 flex items-center justify-center group"
            title="Paneli Göster"
          >
            <PanelLeftOpen className="w-4 h-4 text-slate-500 group-hover:text-white" />
          </button>
        )}

        {/* Orta - Yerleşim Planı */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">
                {tables.length} masa | {unassignedTables.length} atanmamış
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Akıllı Ekip Oluştur */}
              <button
                onClick={handleSmartAutoAssign}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 rounded-lg text-sm font-medium"
              >
                <Wand2 className="w-4 h-4" />
                Akıllı Ekip Oluştur
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 rounded-lg text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Temizle
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto p-4" onClick={closeContextMenu}>
            <div
              className="relative bg-slate-800 rounded-xl mx-auto select-none"
              style={{
                width: event?.venueLayout?.dimensions?.width || 1100,
                height: event?.venueLayout?.dimensions?.height || 700,
                minWidth: 800,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (selectedTableIds.length > 0) {
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    tableIds: selectedTableIds,
                  });
                }
              }}
              onMouseDown={(e) => {
                // Context menu'yü kapat
                if (e.button === 0) {
                  closeContextMenu();
                }
                // Canvas üzerinde başlatılan drag
                if (e.target === e.currentTarget && e.button === 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  setDragStart({ x, y });
                  setDragEnd({ x, y });
                  setIsDragging(true);
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && dragStart) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  setDragEnd({ x, y });

                  // Seçim kutusunun içindeki masaları bul
                  const minX = Math.min(dragStart.x, x);
                  const maxX = Math.max(dragStart.x, x);
                  const minY = Math.min(dragStart.y, y);
                  const maxY = Math.max(dragStart.y, y);

                  const selectedIds = tables
                    .filter(
                      (t) =>
                        t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY
                    )
                    .map((t) => t.id);

                  setSelectedTableIds(selectedIds);
                }
              }}
              onMouseUp={() => {
                setIsDragging(false);
                setDragStart(null);
                setDragEnd(null);
              }}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false);
                  setDragStart(null);
                  setDragEnd(null);
                }
              }}
            >
              {/* Drag Selection Box */}
              {isDragging && dragStart && dragEnd && (
                <div
                  className="absolute border-2 border-purple-500 bg-purple-500/20 pointer-events-none z-50"
                  style={{
                    left: Math.min(dragStart.x, dragEnd.x),
                    top: Math.min(dragStart.y, dragEnd.y),
                    width: Math.abs(dragEnd.x - dragStart.x),
                    height: Math.abs(dragEnd.y - dragStart.y),
                  }}
                />
              )}

              {/* Masalar */}
              {tables.map((table) => {
                const tableTeam = getTableTeam(table.id);
                const isSelected = selectedTableIds.includes(table.id);

                // Masa tipinin kendi rengini kullan, yoksa varsayılan
                const tableTypeColor = table.color || "#64748b";

                // Eğer ekibe atanmışsa ekip rengi, değilse masa tipi rengi
                const bgColor = tableTeam?.color || tableTypeColor;

                return (
                  <div
                    key={table.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTableClick(table.id, e);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleContextMenu(e, table.id);
                    }}
                    className={`absolute cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110"
                        : ""
                    }`}
                    style={{
                      left: table.x - 20,
                      top: table.y - 20,
                      width: 40,
                      height: 40,
                      backgroundColor: bgColor,
                      borderRadius: "50%",
                      border: tableTeam
                        ? "none"
                        : `2px solid ${tableTypeColor}`,
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                      {table.label}
                    </div>
                    {tableTeam && (
                      <div
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: tableTeam.color }}
                        title={tableTeam.name}
                      >
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seçim bilgisi ve hızlı ekip oluşturma */}
          {selectedTableIds.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-800 bg-slate-800/50">
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm">
                  {selectedTableIds.length} masa seçili
                </span>
                <button
                  onClick={() => setSelectedTableIds([])}
                  className="text-xs text-slate-400"
                >
                  Temizle
                </button>
              </div>

              {/* Hızlı Aksiyonlar */}
              <div className="px-3 pb-3 space-y-2">
                {selectedTeamId ? (
                  <button
                    onClick={() =>
                      assignTablesToTeam(selectedTeamId, selectedTableIds)
                    }
                    className="w-full py-2 bg-purple-600 rounded-lg text-sm font-medium"
                  >
                    "{selectedTeam?.name}" Ekibine Ata
                  </button>
                ) : (
                  <button
                    onClick={() => setShowQuickTeamModal(true)}
                    className="w-full py-2 bg-green-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Bu Masalar İçin Ekip Oluştur
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Panel - Ekip Özeti */}
        {showRightPanel ? (
          <div className="w-72 flex-shrink-0 border-l border-slate-800 flex">
            {/* Sağ Panel Toggle Butonu - İç kısımda */}
            <button
              onClick={() => setShowRightPanel(false)}
              className="flex-shrink-0 w-6 bg-slate-700/50 border-r border-slate-700 flex items-center justify-center group"
              title="Paneli Gizle"
            >
              <PanelRightClose className="w-4 h-4 text-slate-500 group-hover:text-white" />
            </button>
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-800">
                <h2 className="font-semibold text-sm">Ekip Özeti</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {teams.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Henüz ekip oluşturulmadı</p>
                    <p className="text-sm mt-1">
                      Sol panelden ekip oluşturun ve masalara atayın
                    </p>
                  </div>
                ) : (
                  teams.map((team) => {
                    const leader = team.members.find(
                      (m) => m.id === team.leaderId
                    );
                    return (
                      <div
                        key={team.id}
                        className="bg-slate-800 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="font-medium flex-1">
                            {team.name}
                          </span>
                          <button
                            onClick={() => deleteTeam(team.id)}
                            className="text-slate-500 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Ekip Üyeleri */}
                        <div className="text-xs text-slate-400 mb-2">
                          {team.members.length} üye
                          {leader && (
                            <span className="text-amber-400">
                              {" "}
                              • Şef: {leader.fullName}
                            </span>
                          )}
                        </div>

                        {/* Atanan Masalar */}
                        {team.tableIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {team.tableIds.slice(0, 10).map((tableId) => {
                              const table = tables.find(
                                (t) => t.id === tableId
                              );
                              return (
                                <span
                                  key={tableId}
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{
                                    backgroundColor: `${team.color}30`,
                                    color: team.color,
                                  }}
                                >
                                  {table?.label || tableId}
                                </span>
                              );
                            })}
                            {team.tableIds.length > 10 && (
                              <span className="text-xs text-slate-500">
                                +{team.tableIds.length - 10} daha
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Henüz masa atanmadı
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* İstatistikler */}
              <div className="p-3 border-t border-slate-800 bg-slate-800/50">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-lg font-bold text-purple-400">
                      {teams.length}
                    </div>
                    <div className="text-slate-400 text-xs">Ekip</div>
                  </div>
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-400">
                      {tables.length - unassignedTables.length}
                    </div>
                    <div className="text-slate-400 text-xs">Atanmış</div>
                  </div>
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-lg font-bold text-amber-400">
                      {unassignedTables.length}
                    </div>
                    <div className="text-slate-400 text-xs">Boş</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowRightPanel(true)}
            className="flex-shrink-0 w-6 bg-slate-800 border-l border-slate-700 flex items-center justify-center group"
            title="Paneli Göster"
          >
            <PanelRightOpen className="w-4 h-4 text-slate-500 group-hover:text-white" />
          </button>
        )}
      </div>

      {/* Yeni Personel Ekleme Modal */}
      <AddStaffModal
        open={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        onSave={() => {
          reloadStaffList();
          setShowAddStaffModal(false);
        }}
      />

      {/* Ekip Oluşturma Modal */}
      <CreateTeamModal
        open={showCreateTeamModal}
        staffList={staffList}
        existingTeams={teams}
        onClose={() => setShowCreateTeamModal(false)}
        onSave={(name, color, members, leaderId) => {
          createTeam(name, color, members, leaderId);
          setShowCreateTeamModal(false);
        }}
      />

      {/* Hızlı Ekip Oluşturma Modal (Masa seçildikten sonra) */}
      <QuickTeamModal
        open={showQuickTeamModal}
        staffList={staffList}
        existingTeams={teams}
        selectedTableIds={selectedTableIds}
        tables={tables}
        onClose={() => setShowQuickTeamModal(false)}
        onSave={(name, color, members, leaderId) => {
          const newTeam = createTeam(name, color, members, leaderId);
          // Seçili masaları yeni ekibe ata
          assignTablesToTeam(newTeam.id, selectedTableIds);
          setShowQuickTeamModal(false);
        }}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100] py-1 min-w-[220px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {/* Ekibe atanmış masalar için farklı menü */}
          {contextMenu.assignedTeam ? (
            <>
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: contextMenu.assignedTeam.color }}
                  />
                  <span className="text-sm font-medium">
                    {contextMenu.assignedTeam.name}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {contextMenu.tableIds.length} masa seçili
                </div>
              </div>

              {/* Ekibe Üye Ekle */}
              <div className="relative group">
                <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-400" />
                  Ekibe Üye Ekle
                  <span className="ml-auto text-slate-500">▶</span>
                </button>
                <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[180px] py-1 max-h-[250px] overflow-y-auto">
                  {staffList
                    .filter(
                      (s) =>
                        !contextMenu.assignedTeam?.members.some(
                          (m) => m.id === s.id
                        )
                    )
                    .map((staff) => (
                      <button
                        key={staff.id}
                        onClick={() => {
                          addMemberToTeamById(
                            contextMenu.assignedTeam!.id,
                            staff.id
                          );
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: staff.color }}
                        />
                        <span className="flex-1">{staff.fullName}</span>
                        {staff.position && (
                          <span className="text-xs text-slate-500">
                            {POSITION_LABELS[staff.position]}
                          </span>
                        )}
                      </button>
                    ))}
                  {staffList.filter(
                    (s) =>
                      !contextMenu.assignedTeam?.members.some(
                        (m) => m.id === s.id
                      )
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Tüm personel ekipte
                    </div>
                  )}
                </div>
              </div>

              {/* Ekip Üyelerini Göster/Yönet */}
              {contextMenu.assignedTeam.members.length > 0 && (
                <div className="relative group">
                  <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Ekip Üyeleri ({contextMenu.assignedTeam.members.length})
                    <span className="ml-auto text-slate-500">▶</span>
                  </button>
                  <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[200px] py-1">
                    {contextMenu.assignedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="px-3 py-2 text-sm flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: member.color }}
                        />
                        <span className="flex-1">{member.fullName}</span>
                        {member.id === contextMenu.assignedTeam?.leaderId && (
                          <span className="text-xs text-amber-400">
                            ★ Lider
                          </span>
                        )}
                        <button
                          onClick={() => {
                            removeMemberFromTeamById(
                              contextMenu.assignedTeam!.id,
                              member.id
                            );
                            setContextMenu(null);
                          }}
                          className="text-red-400 p-1"
                          title="Üyeyi Çıkar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lider Değiştir - Sadece süpervizör/şef yoksa ve birden fazla üye varsa göster */}
              {(() => {
                const team = contextMenu.assignedTeam!;
                const hasSupervisor = team.members.some(
                  (m) => m.position === "supervizor"
                );
                const hasSef = team.members.some((m) => m.position === "sef");
                const needsManualLeader =
                  !hasSupervisor && !hasSef && team.members.length > 1;

                if (!needsManualLeader) return null;

                return (
                  <div className="relative group">
                    <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-400" />
                      Lider Seç
                      <span className="ml-auto text-slate-500">▶</span>
                    </button>
                    <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[180px] py-1">
                      {team.members.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            changeTeamLeader(team.id, member.id);
                            setContextMenu(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                            member.id === team.leaderId ? "bg-slate-700" : ""
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: member.color }}
                          />
                          {member.fullName}
                          {member.id === team.leaderId && (
                            <span className="ml-auto text-amber-400">★</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-slate-700 my-1" />

              {/* Masaları Ekipten Çıkar */}
              <button
                onClick={() => {
                  removeTablesFromTeam(
                    contextMenu.assignedTeam!.id,
                    contextMenu.tableIds
                  );
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-orange-400"
              >
                <RotateCcw className="w-4 h-4" />
                Masaları Ekipten Çıkar
              </button>

              {/* Ekibi Sil */}
              <button
                onClick={() => {
                  setShowDeleteTeamConfirm(contextMenu.assignedTeam!.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Ekibi Sil
              </button>
            </>
          ) : (
            <>
              {/* Atanmamış masalar için normal menü */}
              <div className="px-3 py-2 border-b border-slate-700 text-xs text-slate-400">
                {contextMenu.tableIds.length} masa seçili (atanmamış)
              </div>

              {/* Süpervizör Ata */}
              <div className="relative group">
                <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-400" />
                  Süpervizör Ata
                  <span className="ml-auto text-slate-500">▶</span>
                </button>
                <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[180px] py-1">
                  {staffList
                    .filter((s) => s.position === "supervizor")
                    .map((supervisor) => (
                      <button
                        key={supervisor.id}
                        onClick={() => assignSupervisor(supervisor.id)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: supervisor.color }}
                        />
                        {supervisor.fullName}
                      </button>
                    ))}
                  {staffList.filter((s) => s.position === "supervizor")
                    .length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Süpervizör bulunamadı
                    </div>
                  )}
                </div>
              </div>

              {/* Şef Ata */}
              <div className="relative group">
                <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Şef Ata
                  <span className="ml-auto text-slate-500">▶</span>
                </button>
                <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[180px] py-1">
                  {staffList
                    .filter((s) => s.position === "sef")
                    .map((sef) => (
                      <button
                        key={sef.id}
                        onClick={() => assignSupervisor(sef.id)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sef.color }}
                        />
                        {sef.fullName}
                      </button>
                    ))}
                  {staffList.filter((s) => s.position === "sef").length ===
                    0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Şef bulunamadı
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700 my-1" />

              {/* Mevcut Ekibe Ata */}
              {teams.length > 0 && (
                <div className="relative group">
                  <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-purple-400" />
                    Mevcut Ekibe Ata
                    <span className="ml-auto text-slate-500">▶</span>
                  </button>
                  <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block min-w-[180px] py-1 max-h-[200px] overflow-y-auto">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => assignToExistingTeam(team.id)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                        <span className="ml-auto text-xs text-slate-500">
                          {team.tableIds.length} masa
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Yeni Ekip Oluştur */}
              <button
                onClick={() => {
                  setShowQuickCreateTeamModal(true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-green-400" />
                Yeni Ekip Oluştur
              </button>

              <div className="border-t border-slate-700 my-1" />

              {/* Seçimi Temizle */}
              <button
                onClick={() => {
                  setSelectedTableIds([]);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-slate-400"
              >
                <RotateCcw className="w-4 h-4" />
                Seçimi Temizle
              </button>
            </>
          )}
        </div>
      )}

      {/* Hızlı Ekip Oluşturma Modal (Context Menu'den) */}
      <QuickTeamModal
        open={showQuickCreateTeamModal}
        staffList={staffList}
        existingTeams={teams}
        selectedTableIds={contextMenu?.tableIds || selectedTableIds}
        tables={tables}
        onClose={() => setShowQuickCreateTeamModal(false)}
        onSave={(name, color, members, leaderId) => {
          quickCreateTeam(name, color, leaderId);
          setShowQuickCreateTeamModal(false);
        }}
      />

      {/* Tümünü Temizle Onay Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Tüm Atamaları Temizle"
        description="Tüm atamalar ve ekipler silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
        confirmText="Temizle"
        cancelText="İptal"
        variant="destructive"
        onConfirm={clearAllAssignments}
      />

      {/* Ekip Silme Onay Dialog */}
      <ConfirmDialog
        open={!!showDeleteTeamConfirm}
        onOpenChange={() => setShowDeleteTeamConfirm(null)}
        title="Ekibi Sil"
        description={`"${
          teams.find((t) => t.id === showDeleteTeamConfirm)?.name || ""
        }" ekibini silmek istediğinize emin misiniz? Ekip üyeleri ve masa atamaları kaldırılacak.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        onConfirm={() => {
          if (showDeleteTeamConfirm) {
            deleteTeam(showDeleteTeamConfirm);
            setShowDeleteTeamConfirm(null);
          }
        }}
      />
    </div>
  );
}

// Yeni Personel Ekleme Modal Component
function AddStaffModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    color: "#3b82f6",
    position: "" as StaffPosition | "",
    avatar: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");

  // Form sıfırla
  useEffect(() => {
    if (open) {
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        color: "#3b82f6",
        position: "",
        avatar: "",
      });
      setAvatarPreview("");
      setError("");
    }
  }, [open]);

  const colors = [
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#8b5cf6",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
  ];

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Sadece JPG ve PNG dosyaları kabul edilir");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Fotoğraf 5MB'dan küçük olmalıdır");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const response = await uploadApi.uploadAvatar(file);
      const { urls } = response.data.data;
      setAvatarPreview(urls.medium);
      setFormData((prev) => ({ ...prev, avatar: urls.medium }));
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Fotoğraf yüklenirken hata oluştu"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.fullName.trim()) {
      setError("Ad soyad zorunludur");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email zorunludur");
      return;
    }
    if (!formData.password) {
      setError("Şifre zorunludur");
      return;
    }
    if (!formData.position) {
      setError("Görev seçimi zorunludur");
      return;
    }

    setSaving(true);
    try {
      await staffApi.create({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        color: formData.color,
        position: formData.position || undefined,
        avatar: formData.avatar || undefined,
      });
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Personel Ekle</DialogTitle>
          <DialogDescription className="text-slate-400">
            Servis ekibine yeni bir personel ekleyin
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" onClose={() => setError("")}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar
                className="w-20 h-20 border-4"
                style={{ borderColor: formData.color }}
              >
                <AvatarImage src={getAvatarUrl(avatarPreview)} />
                <AvatarFallback
                  style={{ backgroundColor: formData.color }}
                  className="text-white font-bold text-2xl"
                >
                  {formData.fullName
                    ? formData.fullName.charAt(0).toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <label
                className={`absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center ${
                  uploading ? "opacity-50 cursor-wait" : "cursor-pointer"
                }`}
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Ad Soyad */}
          <div className="space-y-2">
            <Label>Ad Soyad *</Label>
            <Input
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              placeholder="Örn: Ahmet Yılmaz"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="ornek@email.com"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Şifre */}
          <div className="space-y-2">
            <Label>Şifre *</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="••••••••"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Telefon */}
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="555-000-0000"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Görev */}
          <div className="space-y-2">
            <Label>Görev *</Label>
            <Select
              value={formData.position}
              onValueChange={(v) =>
                setFormData({ ...formData, position: v as StaffPosition })
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Görev seçin" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="supervizor">Süpervizör</SelectItem>
                <SelectItem value="sef">Şef</SelectItem>
                <SelectItem value="garson">Garson</SelectItem>
                <SelectItem value="komi">Komi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Renk */}
          <div className="space-y-2">
            <Label>Renk</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {formData.color === color && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button type="submit" disabled={saving} className="bg-purple-600">
              {saving ? "Kaydediliyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ekip Oluşturma Modal Component
function CreateTeamModal({
  open,
  staffList,
  existingTeams,
  onClose,
  onSave,
}: {
  open: boolean;
  staffList: Staff[];
  existingTeams: ServiceTeam[];
  onClose: () => void;
  onSave: (
    name: string,
    color: string,
    members: Staff[],
    leaderId?: string
  ) => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#3b82f6");
  const [selectedMembers, setSelectedMembers] = useState<Staff[]>([]);
  const [leaderId, setLeaderId] = useState<string>("none");
  const [error, setError] = useState("");

  // Form sıfırla
  useEffect(() => {
    if (open) {
      setTeamName("");
      setTeamColor("#3b82f6");
      setSelectedMembers([]);
      setLeaderId("none");
      setError("");
    }
  }, [open]);

  const colors = [
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#8b5cf6",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
  ];

  // Personel ekibe eklenebilir mi?
  const canAddMember = (staff: Staff): boolean => {
    if (!staff.position) return true;
    const rules = ROLE_RULES[staff.position];

    // Zaten seçili mi?
    if (selectedMembers.some((m) => m.id === staff.id)) return false;

    // Birden fazla ekipte olamıyorsa ve başka ekipte varsa
    if (!rules.canBeInMultipleTeams) {
      const inOtherTeam = existingTeams.some((t) =>
        t.members.some((m) => m.id === staff.id)
      );
      if (inOtherTeam) return false;
    }

    return true;
  };

  const toggleMember = (staff: Staff) => {
    if (selectedMembers.some((m) => m.id === staff.id)) {
      setSelectedMembers((prev) => prev.filter((m) => m.id !== staff.id));
      if (leaderId === staff.id) setLeaderId("none");
    } else if (canAddMember(staff)) {
      setSelectedMembers((prev) => [...prev, staff]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!teamName.trim()) {
      setError("Ekip adı zorunludur");
      return;
    }

    if (selectedMembers.length === 0) {
      setError("En az bir üye seçmelisiniz");
      return;
    }

    onSave(
      teamName,
      teamColor,
      selectedMembers,
      leaderId && leaderId !== "none" ? leaderId : undefined
    );
  };

  // Şef olabilecek üyeler
  const potentialLeaders = selectedMembers.filter(
    (m) => m.position && ROLE_RULES[m.position].canLead
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Ekip Oluştur</DialogTitle>
          <DialogDescription className="text-slate-400">
            Servis ekibi oluşturun ve üyelerini seçin
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" onClose={() => setError("")}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Ekip Adı */}
          <div className="space-y-2">
            <Label>Ekip Adı *</Label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Örn: A Bölgesi Ekibi"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Ekip Rengi */}
          <div className="space-y-2">
            <Label>Ekip Rengi</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTeamColor(color)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    teamColor === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {teamColor === color && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Üye Seçimi */}
          <div className="space-y-2">
            <Label>Ekip Üyeleri * ({selectedMembers.length} seçili)</Label>
            <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg p-2 space-y-1">
              {staffList.map((staff) => {
                const isSelected = selectedMembers.some(
                  (m) => m.id === staff.id
                );
                const canAdd = canAddMember(staff);
                const inOtherTeam = existingTeams.some((t) =>
                  t.members.some((m) => m.id === staff.id)
                );

                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleMember(staff)}
                    disabled={!canAdd && !isSelected}
                    className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm ${
                      isSelected
                        ? "bg-purple-600/20 border border-purple-500"
                        : canAdd
                        ? "bg-slate-700"
                        : "bg-slate-700/50 opacity-50"
                    }`}
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={getAvatarUrl(staff.avatar)} />
                      <AvatarFallback
                        style={{ backgroundColor: staff.color }}
                        className="text-xs"
                      >
                        {staff.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{staff.fullName}</span>
                    {staff.position && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          POSITION_COLORS[staff.position]
                        }`}
                      >
                        {POSITION_LABELS[staff.position]}
                      </span>
                    )}
                    {inOtherTeam && !isSelected && (
                      <span className="text-xs text-slate-500">
                        Başka ekipte
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-purple-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Şef Seçimi */}
          {potentialLeaders.length > 0 && (
            <div className="space-y-2">
              <Label>Ekip Şefi (Opsiyonel)</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Şef seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="none">Şef yok</SelectItem>
                  {potentialLeaders.map((leader) => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Kural Bilgisi */}
          <div className="text-xs text-slate-500 bg-slate-700/50 p-2 rounded">
            <p>• Garson ve Komi tek bir ekipte olabilir</p>
            <p>• Şef ve Debarasör birden fazla ekipte olabilir</p>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button type="submit" className="bg-purple-600">
              Ekip Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Hızlı Ekip Oluşturma Modal (Masa seçildikten sonra, tek tek üye ekleme)
function QuickTeamModal({
  open,
  staffList,
  existingTeams,
  selectedTableIds,
  tables,
  onClose,
  onSave,
}: {
  open: boolean;
  staffList: Staff[];
  existingTeams: ServiceTeam[];
  selectedTableIds: string[];
  tables: TableData[];
  onClose: () => void;
  onSave: (
    name: string,
    color: string,
    members: Staff[],
    leaderId?: string
  ) => void;
}) {
  const [step, setStep] = useState<"info" | "members">("info");
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#3b82f6");
  const [selectedMembers, setSelectedMembers] = useState<Staff[]>([]);
  const [leaderId, setLeaderId] = useState<string>("none");
  const [error, setError] = useState("");

  // Form sıfırla
  useEffect(() => {
    if (open) {
      setStep("info");
      setTeamName(`Ekip ${existingTeams.length + 1}`);
      setTeamColor("#3b82f6");
      setSelectedMembers([]);
      setLeaderId("none");
      setError("");
    }
  }, [open, existingTeams.length]);

  const colors = [
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#8b5cf6",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
  ];

  // Seçili masaların etiketleri
  const selectedTableLabels = selectedTableIds
    .map((id) => tables.find((t) => t.id === id)?.label)
    .filter(Boolean)
    .slice(0, 5);

  // Personel ekibe eklenebilir mi?
  const canAddMember = (staff: Staff): boolean => {
    if (!staff.position) return true;
    const rules = ROLE_RULES[staff.position];
    if (selectedMembers.some((m) => m.id === staff.id)) return false;
    if (!rules.canBeInMultipleTeams) {
      const inOtherTeam = existingTeams.some((t) =>
        t.members.some((m) => m.id === staff.id)
      );
      if (inOtherTeam) return false;
    }
    return true;
  };

  const addMember = (staff: Staff) => {
    if (canAddMember(staff)) {
      setSelectedMembers((prev) => [...prev, staff]);
    }
  };

  const removeMember = (staffId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== staffId));
    if (leaderId === staffId) setLeaderId("none");
  };

  const handleNext = () => {
    if (!teamName.trim()) {
      setError("Ekip adı zorunludur");
      return;
    }
    setError("");
    setStep("members");
  };

  const handleSubmit = () => {
    if (selectedMembers.length === 0) {
      setError("En az bir üye eklemelisiniz");
      return;
    }
    onSave(
      teamName,
      teamColor,
      selectedMembers,
      leaderId && leaderId !== "none" ? leaderId : undefined
    );
  };

  // Şef olabilecek üyeler
  const potentialLeaders = selectedMembers.filter(
    (m) => m.position && ROLE_RULES[m.position].canLead
  );

  // Pozisyona göre grupla
  const staffByPosition = {
    supervizor: staffList.filter((s) => s.position === "supervizor"),
    sef: staffList.filter((s) => s.position === "sef"),
    garson: staffList.filter((s) => s.position === "garson"),
    komi: staffList.filter((s) => s.position === "komi"),
    other: staffList.filter((s) => !s.position),
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "info" ? "Yeni Ekip Oluştur" : "Ekip Üyelerini Seç"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {selectedTableIds.length} masa için ekip:{" "}
            {selectedTableLabels.join(", ")}
            {selectedTableIds.length > 5 &&
              `... +${selectedTableIds.length - 5}`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mx-4">
            <Alert variant="destructive" onClose={() => setError("")}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {step === "info" ? (
          /* Adım 1: Ekip Bilgileri */
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Ekip Adı</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Örn: A Bölgesi"
                className="bg-slate-700 border-slate-600"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Ekip Rengi</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTeamColor(color)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      teamColor === color
                        ? "border-white scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {teamColor === color && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button onClick={handleNext} className="bg-purple-600">
                Devam → Üye Seç
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Adım 2: Üye Seçimi */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Seçili Üyeler */}
            <div className="p-3 border-b border-slate-700">
              <Label className="text-xs text-slate-400">
                Seçili Üyeler ({selectedMembers.length})
              </Label>
              {selectedMembers.length === 0 ? (
                <p className="text-sm text-slate-500 mt-1">
                  Aşağıdan üye ekleyin
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded-full text-sm"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.fullName.charAt(0)}
                      </div>
                      <span>{member.fullName.split(" ")[0]}</span>
                      {member.id === leaderId && (
                        <span className="text-amber-400">★</span>
                      )}
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-slate-400 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Şef Seçimi */}
            {potentialLeaders.length > 0 && (
              <div className="p-3 border-b border-slate-700">
                <Label className="text-xs text-slate-400">Ekip Şefi</Label>
                <div className="flex gap-2 mt-1">
                  {potentialLeaders.map((leader) => (
                    <button
                      key={leader.id}
                      onClick={() =>
                        setLeaderId(leaderId === leader.id ? "none" : leader.id)
                      }
                      className={`px-2 py-1 rounded text-xs ${
                        leaderId === leader.id
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500"
                          : "bg-slate-700"
                      }`}
                    >
                      {leader.fullName.split(" ")[0]}{" "}
                      {leaderId === leader.id && "★"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Personel Listesi */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {Object.entries(staffByPosition).map(([position, staffs]) => {
                if (staffs.length === 0) return null;
                const posKey = position as StaffPosition;
                return (
                  <div key={position}>
                    <Label className="text-xs text-slate-500 uppercase">
                      {position === "other" ? "Diğer" : POSITION_LABELS[posKey]}
                    </Label>
                    <div className="mt-1 space-y-1">
                      {staffs.map((staff) => {
                        const isSelected = selectedMembers.some(
                          (m) => m.id === staff.id
                        );
                        const canAdd = canAddMember(staff);
                        const inOtherTeam = existingTeams.some((t) =>
                          t.members.some((m) => m.id === staff.id)
                        );

                        return (
                          <button
                            key={staff.id}
                            onClick={() =>
                              isSelected
                                ? removeMember(staff.id)
                                : addMember(staff)
                            }
                            disabled={!canAdd && !isSelected}
                            className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm ${
                              isSelected
                                ? "bg-purple-600/20 border border-purple-500"
                                : canAdd
                                ? "bg-slate-700"
                                : "bg-slate-700/30 opacity-50"
                            }`}
                          >
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={getAvatarUrl(staff.avatar)} />
                              <AvatarFallback
                                style={{ backgroundColor: staff.color }}
                                className="text-xs"
                              >
                                {staff.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">
                              {staff.fullName}
                            </span>
                            {inOtherTeam && !isSelected && (
                              <span className="text-xs text-slate-500">
                                Ekipte
                              </span>
                            )}
                            {isSelected && (
                              <Check className="w-4 h-4 text-purple-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="p-3 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setStep("info")}
                className="border-slate-600"
              >
                ← Geri
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-green-600"
                disabled={selectedMembers.length === 0}
              >
                Ekibi Oluştur ({selectedMembers.length} üye)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
