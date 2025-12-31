"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  X,
  UserPlus,
  Trash2,
  Clock,
  Briefcase,
  ChevronRight,
  Users,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Staff,
  WorkShift,
  STAFF_ROLES,
  StaffRole,
  GroupStaffAssignment,
} from "../types";

// Personel kategorileri
const STAFF_CATEGORIES = [
  {
    key: "supervisor",
    label: "Süpervizör",
    color: "#ef4444",
    positions: ["supervizor", "supervisor"],
  },
  {
    key: "captain",
    label: "Kaptan",
    color: "#f59e0b",
    positions: ["sef", "captain", "şef"],
  },
  {
    key: "waiter",
    label: "Garson",
    color: "#3b82f6",
    positions: ["garson", "waiter"],
  },
  {
    key: "runner",
    label: "Komi",
    color: "#22c55e",
    positions: ["komi", "runner", "komis", "commis"],
  },
  {
    key: "barman",
    label: "Barmen",
    color: "#06b6d4",
    positions: ["barmen", "barman", "bartender"],
  },
  {
    key: "hostess",
    label: "Hostes",
    color: "#ec4899",
    positions: ["hostes", "hostess", "host"],
  },
];

// Seçilen personel satırı tipi
interface SelectedStaffRow {
  id: string;
  staffId: string;
  staffName: string;
  role: StaffRole;
  shiftId: string | null;
  shiftStart: string;
  shiftEnd: string;
  position: string;
  department: string;
  isExtra: boolean;
}

// Ekstra personel tipi (API'den gelen)
interface ExtraStaffFromAPI {
  id: string;
  fullName: string;
  position?: string;
  role?: string;
  shiftStart?: string;
  shiftEnd?: string;
  color?: string;
  assignedTables?: string[];
  workLocation?: string;
}

// Ekstra personel tipi
interface ExtraStaffInput {
  fullName: string;
  role: StaffRole;
  shiftStart: string;
  shiftEnd: string;
}

interface GroupStaffSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    assignments: GroupStaffAssignment[],
    extraStaff: ExtraStaffInput[]
  ) => void;
  onDissolveGroup?: () => void; // Grubu dağıt
  onAddTables?: (tableIds: string[]) => void; // Gruba masa ekle
  onRemoveTable?: (tableId: string) => void; // Gruptan masa çıkar
  groupId: string;
  groupName: string;
  groupColor: string;
  tableLabels?: string[]; // Gruptaki masa numaraları
  tableIds?: string[]; // Gruptaki masa ID'leri (çıkarma için)
  availableTables?: Array<{ id: string; label: string }>; // Grupsuz masalar
  allStaff: Staff[];
  extraStaffList?: ExtraStaffFromAPI[]; // API'den gelen ekstra personeller
  workShifts: WorkShift[];
  existingAssignments?: GroupStaffAssignment[];
  isLoading?: boolean;
}

export function GroupStaffSelectModal({
  open,
  onClose,
  onSave,
  onDissolveGroup,
  onAddTables,
  onRemoveTable,
  groupId,
  groupName,
  groupColor,
  tableLabels = [],
  tableIds = [],
  availableTables = [],
  allStaff,
  extraStaffList = [],
  workShifts,
  existingAssignments = [],
  isLoading = false,
}: GroupStaffSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<SelectedStaffRow[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Masa ekleme state
  const [showAddTableSelect, setShowAddTableSelect] = useState(false);
  const [selectedTableToAdd, setSelectedTableToAdd] = useState<string>("");

  // Ekstra personel ekleme - sadece ad soyad
  const [showExtraInput, setShowExtraInput] = useState(false);
  const [extraName, setExtraName] = useState("");

  // Role değerini normalize et - STAFF_ROLES'daki değerlerle eşleşmeli
  const normalizeRole = useCallback((role?: string): StaffRole => {
    if (!role) return "waiter";
    const r = role.toLowerCase();
    if (r === "supervisor" || r === "süpervizör") return "supervisor";
    if (r === "captain" || r === "kaptan" || r === "şef") return "captain";
    if (r === "runner" || r === "komi" || r === "commis") return "runner";
    if (r === "hostess" || r === "hostes") return "hostess";
    if (r === "barman" || r === "barmen" || r === "bartender") return "barman";
    return "waiter"; // Garson varsayılan
  }, []);

  // Mevcut atamaları yükle (normal ve ekstra personeller dahil)
  // Modal açıldığında VEYA groupId değiştiğinde yeniden yükle
  useEffect(() => {
    if (!open) return; // Modal kapalıysa işlem yapma

    console.log("🔄 useEffect: Modal açıldı, existingAssignments yükleniyor:", {
      groupId,
      groupName,
      existingAssignmentsCount: existingAssignments.length,
      existingAssignments: existingAssignments.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: a.staffName,
        role: a.role,
        isExtra: a.isExtra,
      })),
      tableLabels,
    });

    if (existingAssignments.length > 0) {
      const rows: SelectedStaffRow[] = existingAssignments.map((a) => {
        // Ekstra personel mi kontrol et
        const isExtra = a.isExtra === true;
        const staff = isExtra ? null : allStaff.find((s) => s.id === a.staffId);

        return {
          id: a.id,
          staffId: a.staffId,
          staffName: isExtra
            ? a.staffName || "Ekstra Personel"
            : staff?.fullName || "Bilinmeyen",
          role: normalizeRole(a.role),
          shiftId: a.shiftId || null,
          shiftStart: a.shiftStart,
          shiftEnd: a.shiftEnd,
          position: isExtra ? "Ekstra" : staff?.position || "",
          department: isExtra ? "-" : staff?.department || "",
          isExtra: isExtra,
        };
      });
      console.log(
        "📋 Mevcut atamalar yüklendi:",
        rows.length,
        "personel",
        rows.map((r) => ({
          name: r.staffName,
          isExtra: r.isExtra,
          role: r.role,
        }))
      );
      setSelectedStaff(rows);
    } else {
      // Mevcut atama yoksa state'i sıfırla
      console.log("📋 Mevcut atama yok, state sıfırlandı");
      setSelectedStaff([]);
    }
  }, [
    open,
    groupId,
    existingAssignments,
    allStaff,
    normalizeRole,
    groupName,
    tableLabels,
  ]);

  // Personelleri kategorilere göre grupla
  const staffByCategory = useMemo(() => {
    const result: Record<string, Staff[]> = {};

    STAFF_CATEGORIES.forEach((cat) => {
      result[cat.key] = allStaff.filter((s) => {
        const pos = s.position?.toLowerCase() || "";
        return cat.positions.some((p) => pos.includes(p));
      });
    });

    return result;
  }, [allStaff]);

  // Bu grubun masalarına veya doğrudan gruba atanmış ekstra personeller
  const relevantExtraStaff = useMemo(() => {
    if (!extraStaffList || extraStaffList.length === 0) {
      console.log("⚠️ relevantExtraStaff: extraStaffList boş");
      return [];
    }

    // Grubun masa numaralarını al
    const groupTableLabels = new Set(tableLabels.map((l) => l.toString()));
    console.log("🔍 relevantExtraStaff hesaplanıyor:", {
      groupId,
      extraStaffCount: extraStaffList.length,
      groupTableLabels: Array.from(groupTableLabels),
      extraStaffSample: extraStaffList.slice(0, 3).map((es) => ({
        fullName: es.fullName,
        assignedTables: es.assignedTables,
        assignedGroups: (es as any).assignedGroups,
      })),
    });

    // Ekstra personellerin assignedTables veya assignedGroups ile eşleştir
    const filtered = extraStaffList.filter((es) => {
      const esAny = es as any;

      // 1. Önce assignedGroups kontrolü - doğrudan gruba atanmış mı?
      if (esAny.assignedGroups && Array.isArray(esAny.assignedGroups)) {
        const groupsArray = esAny.assignedGroups as string[];
        if (groupsArray.includes(groupId)) {
          console.log(
            "✅ Gruba doğrudan atanmış ekstra personel:",
            es.fullName,
            "gruplar:",
            groupsArray
          );
          return true;
        }
      }

      // 2. assignedTables kontrolü - masalara atanmış mı?
      if (!es.assignedTables) {
        console.log(`⏭️ ${es.fullName}: assignedTables ve assignedGroups yok`);
        return false;
      }

      // assignedTables string ise array'e çevir
      let tablesArray: string[] = [];
      if (typeof es.assignedTables === "string") {
        // Virgülle ayrılmış string ise parse et
        tablesArray = (es.assignedTables as string)
          .split(",")
          .map((t) => t.trim());
      } else if (Array.isArray(es.assignedTables)) {
        tablesArray = es.assignedTables;
      }

      if (tablesArray.length === 0) {
        console.log(`⏭️ ${es.fullName}: assignedTables boş array`);
        return false;
      }

      // Herhangi bir masa eşleşiyorsa göster
      const matches = tablesArray.some((t) =>
        groupTableLabels.has(t.toString())
      );
      if (matches) {
        console.log(
          "✅ Masalar üzerinden eşleşen ekstra personel:",
          es.fullName,
          "masalar:",
          tablesArray,
          "grup masaları:",
          Array.from(groupTableLabels)
        );
      }
      return matches;
    });

    console.log("📋 relevantExtraStaff sonuç:", filtered.length, "personel");
    return filtered;
  }, [extraStaffList, tableLabels, groupId]);

  // Arama filtresi
  const filteredStaffByCategory = useMemo(() => {
    if (!searchQuery.trim()) return staffByCategory;

    const query = searchQuery.toLowerCase();
    const result: Record<string, Staff[]> = {};

    Object.entries(staffByCategory).forEach(([key, staffList]) => {
      result[key] = staffList.filter(
        (s) =>
          s.fullName.toLowerCase().includes(query) ||
          s.position?.toLowerCase().includes(query) ||
          s.department?.toLowerCase().includes(query)
      );
    });

    return result;
  }, [staffByCategory, searchQuery]);

  // Filtrelenmiş ekstra personeller
  const filteredExtraStaff = useMemo(() => {
    if (!searchQuery.trim()) return relevantExtraStaff;

    const query = searchQuery.toLowerCase();
    return relevantExtraStaff.filter(
      (es) =>
        es.fullName.toLowerCase().includes(query) ||
        es.position?.toLowerCase().includes(query)
    );
  }, [relevantExtraStaff, searchQuery]);

  // Personel seç
  const handleSelectStaff = useCallback(
    (staff: Staff, category: string) => {
      // Zaten seçili mi kontrol et
      if (selectedStaff.some((s) => s.staffId === staff.id)) return;

      const categoryConfig = STAFF_CATEGORIES.find((c) => c.key === category);
      const defaultShift = workShifts.length > 0 ? workShifts[0] : null;

      const newRow: SelectedStaffRow = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        staffId: staff.id,
        staffName: staff.fullName,
        role: category as StaffRole,
        shiftId: defaultShift?.id || null,
        shiftStart: defaultShift?.startTime || "18:00",
        shiftEnd: defaultShift?.endTime || "02:00",
        position: staff.position || "",
        department: staff.department || "",
        isExtra: false,
      };

      setSelectedStaff((prev) => [...prev, newRow]);
    },
    [selectedStaff, workShifts]
  );

  // API'den gelen ekstra personeli seç
  const handleSelectExtraStaffFromAPI = useCallback(
    (extraStaff: ExtraStaffFromAPI) => {
      // Zaten seçili mi kontrol et
      if (selectedStaff.some((s) => s.staffId === extraStaff.id)) {
        console.log("⚠️ Ekstra personel zaten seçili:", extraStaff.fullName);
        return;
      }

      // Role değerini normalize et - STAFF_ROLES'daki değerlerle eşleşmeli
      const normalizeRole = (role?: string): StaffRole => {
        if (!role) return "waiter";
        const r = role.toLowerCase();
        if (r === "supervisor" || r === "süpervizör") return "supervisor";
        if (r === "captain" || r === "kaptan" || r === "şef") return "captain";
        if (r === "runner" || r === "komi" || r === "commis") return "runner";
        if (r === "hostess" || r === "hostes") return "hostess";
        if (r === "barman" || r === "barmen" || r === "bartender")
          return "barman";
        return "waiter"; // Garson varsayılan
      };

      const normalizedRole = normalizeRole(extraStaff.role);
      console.log("✅ Ekstra personel seçiliyor:", {
        fullName: extraStaff.fullName,
        originalRole: extraStaff.role,
        normalizedRole,
        shiftStart: extraStaff.shiftStart,
        shiftEnd: extraStaff.shiftEnd,
      });

      const newRow: SelectedStaffRow = {
        id: `extra-api-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        staffId: extraStaff.id,
        staffName: extraStaff.fullName,
        role: normalizedRole,
        shiftId: null,
        shiftStart: extraStaff.shiftStart || "17:00",
        shiftEnd: extraStaff.shiftEnd || "04:00",
        position: extraStaff.position || "Garson",
        department: "Ekstra",
        isExtra: true,
      };

      setSelectedStaff((prev) => {
        const updated = [...prev, newRow];
        console.log(
          "📋 selectedStaff güncellendi:",
          updated.length,
          "personel"
        );
        return updated;
      });
    },
    [selectedStaff]
  );

  // Personel kaldır
  const handleRemoveStaff = useCallback((rowId: string) => {
    setSelectedStaff((prev) => prev.filter((s) => s.id !== rowId));
  }, []);

  // Satır güncelle
  const handleUpdateRow = useCallback(
    (rowId: string, field: keyof SelectedStaffRow, value: string) => {
      setSelectedStaff((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;

          // Vardiya seçildiğinde saatleri de güncelle
          if (field === "shiftId" && value !== "custom") {
            const shift = workShifts.find((s) => s.id === value);
            if (shift) {
              return {
                ...row,
                shiftId: value,
                shiftStart: shift.startTime,
                shiftEnd: shift.endTime,
              };
            }
          }

          return { ...row, [field]: value };
        })
      );
    },
    [workShifts]
  );

  // Ekstra personel ekle - sadece ad soyad, diğer ayarlar sağ panelde
  const handleAddExtraStaff = useCallback(() => {
    if (!extraName.trim()) return;

    const defaultShift = workShifts.length > 0 ? workShifts[0] : null;

    const newRow: SelectedStaffRow = {
      id: `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      staffId: `extra-${Date.now()}`,
      staffName: extraName.trim(),
      role: "waiter", // Varsayılan görev, sağ panelde değiştirilebilir
      shiftId: defaultShift?.id || null,
      shiftStart: defaultShift?.startTime || "18:00",
      shiftEnd: defaultShift?.endTime || "02:00",
      position: "Ekstra",
      department: "-",
      isExtra: true,
    };

    setSelectedStaff((prev) => [...prev, newRow]);
    setExtraName("");
    setShowExtraInput(false);
  }, [extraName, workShifts]);

  // Masa ekle
  const handleAddTable = useCallback(() => {
    if (!selectedTableToAdd || !onAddTables) return;
    onAddTables([selectedTableToAdd]);
    setSelectedTableToAdd("");
    setShowAddTableSelect(false);
  }, [selectedTableToAdd, onAddTables]);

  // Grubu dağıt
  const handleDissolve = useCallback(() => {
    if (onDissolveGroup) {
      onDissolveGroup();
      onClose();
    }
  }, [onDissolveGroup, onClose]);

  // Seçilen personelleri görevlerine göre grupla
  const staffByRole = useMemo(() => {
    const grouped: Record<string, SelectedStaffRow[]> = {};
    selectedStaff.forEach((staff) => {
      if (!grouped[staff.role]) {
        grouped[staff.role] = [];
      }
      grouped[staff.role].push(staff);
    });
    console.log("🔄 staffByRole güncellendi:", {
      totalSelected: selectedStaff.length,
      roles: Object.keys(grouped),
      counts: Object.fromEntries(
        Object.entries(grouped).map(([k, v]) => [k, v.length])
      ),
    });
    return grouped;
  }, [selectedStaff]);

  // Kaydet - tüm personelleri (normal + ekstra) tek array'de gönder
  const handleSave = useCallback(() => {
    // Tüm personelleri (normal ve ekstra) tek array'de topla
    const allAssignments: GroupStaffAssignment[] = selectedStaff.map((s) => ({
      id:
        s.id.startsWith("temp-") || s.id.startsWith("extra-")
          ? `assign-${Date.now()}-${Math.random().toString(36).slice(2)}`
          : s.id,
      staffId: s.staffId,
      staffName: s.isExtra ? s.staffName : undefined, // Ekstra personel için ad kaydet
      role: s.role,
      shiftId: s.shiftId || undefined,
      shiftStart: s.shiftStart,
      shiftEnd: s.shiftEnd,
      isExtra: s.isExtra, // Ekstra personel flag'i
    }));

    // extraStaff artık boş array - tüm personeller allAssignments içinde
    onSave(allAssignments, []);
  }, [selectedStaff, onSave]);

  // Seçili personel sayısı
  const selectedCount = selectedStaff.length;

  // Modal kapanma handler'ı - debounce için zaman kaydı
  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        // Modal kapanma zamanını kaydet (WizardNavigation'da Enter key debounce için)
        (window as any).__lastModalCloseTime = Date.now();
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent
        className="bg-slate-800 border-slate-700 overflow-hidden flex flex-col"
        style={{ maxWidth: "1200px", width: "95vw", maxHeight: "90vh" }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: groupColor }}
              />
              <span>{groupName}</span>
              <span className="text-slate-400 font-normal">
                - Personel Seçimi
              </span>
            </DialogTitle>
            {/* Grup İşlemleri Butonları */}
            <div className="flex items-center gap-2">
              {/* Masa Ekle */}
              {onAddTables && availableTables.length > 0 && (
                <div className="flex items-center gap-1">
                  {showAddTableSelect ? (
                    <>
                      <Select
                        value={selectedTableToAdd}
                        onValueChange={setSelectedTableToAdd}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs bg-slate-700 border-slate-600">
                          <SelectValue placeholder="Masa seç" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTables.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              {table.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleAddTable}
                        disabled={!selectedTableToAdd}
                        className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowAddTableSelect(false);
                          setSelectedTableToAdd("");
                        }}
                        className="h-7 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddTableSelect(true)}
                      className="h-7 text-xs border-emerald-600 text-emerald-400 hover:bg-emerald-600/20"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Masa Ekle
                    </Button>
                  )}
                </div>
              )}
              {/* Grubu Dağıt */}
              {onDissolveGroup && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDissolve}
                  className="h-7 text-xs border-red-600 text-red-400 hover:bg-red-600/20"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Grubu Dağıt
                </Button>
              )}
            </div>
          </div>
          {/* Masa numaraları */}
          {tableLabels.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-slate-500">Masalar:</span>
              <div className="flex flex-wrap gap-1">
                {tableLabels.map((label, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs px-2 py-0.5 flex items-center gap-1"
                    style={{ borderColor: groupColor, color: groupColor }}
                  >
                    {label}
                    {/* Masa çıkarma butonu - en az 2 masa kalmalı */}
                    {onRemoveTable &&
                      tableIds[idx] &&
                      tableLabels.length > 2 && (
                        <button
                          onClick={() => onRemoveTable(tableIds[idx])}
                          className="ml-1 hover:bg-slate-600/50 rounded-full p-0.5 transition-colors"
                          title="Masayı gruptan çıkar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Sol Panel - Personel Listesi */}
          <div className="w-2/5 flex flex-col border-r border-slate-700 pr-4 overflow-hidden">
            {/* Arama */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Personel ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-600"
              />
            </div>

            {/* Accordion Kategoriler */}
            <div className="flex-1 overflow-y-auto">
              <Accordion
                type="multiple"
                value={expandedCategories}
                onValueChange={setExpandedCategories}
                className="space-y-2"
              >
                {STAFF_CATEGORIES.map((category) => {
                  const staffList = filteredStaffByCategory[category.key] || [];
                  const selectedInCategory = selectedStaff.filter(
                    (s) =>
                      !s.isExtra &&
                      staffByCategory[category.key]?.some(
                        (st) => st.id === s.staffId
                      )
                  ).length;

                  return (
                    <AccordionItem
                      key={category.key}
                      value={category.key}
                      className="border border-slate-700 rounded-lg overflow-hidden"
                    >
                      <AccordionTrigger className="px-3 py-2 hover:bg-slate-700/50 [&[data-state=open]]:bg-slate-700/30">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm font-medium">
                            {category.label}
                          </span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {staffList.length}
                          </Badge>
                          {selectedInCategory > 0 && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                              {selectedInCategory} seçili
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-2">
                        {staffList.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2 text-center">
                            Bu kategoride personel yok
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {staffList.map((staff) => {
                              const isSelected = selectedStaff.some(
                                (s) => s.staffId === staff.id
                              );
                              return (
                                <button
                                  key={staff.id}
                                  onClick={() =>
                                    handleSelectStaff(staff, category.key)
                                  }
                                  disabled={isSelected}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors",
                                    isSelected
                                      ? "bg-slate-600/50 opacity-50 cursor-not-allowed"
                                      : "hover:bg-slate-700/50 cursor-pointer"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                      {staff.fullName}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                      {staff.position} •{" "}
                                      {staff.department || "-"}
                                    </p>
                                  </div>
                                  {isSelected ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 text-xs ml-2">
                                      Seçili
                                    </Badge>
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 ml-2" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}

                {/* API'den Gelen Ekstra Personeller - Bu grubun masalarına atanmış */}
                {filteredExtraStaff.length > 0 && (
                  <AccordionItem
                    value="extra-api"
                    className="border border-emerald-600/50 rounded-lg overflow-hidden bg-emerald-500/5"
                  >
                    <AccordionTrigger className="px-3 py-2 hover:bg-emerald-700/20">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">
                          Bu Grubun Ekstra Personeli
                        </span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                          {filteredExtraStaff.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <p className="text-xs text-slate-400 mb-2 px-1">
                        Bu masalara atanmış ekstra personeller
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {filteredExtraStaff.map((extraStaff) => {
                          const isSelected = selectedStaff.some(
                            (s) => s.staffId === extraStaff.id
                          );
                          return (
                            <button
                              key={extraStaff.id}
                              onClick={() =>
                                handleSelectExtraStaffFromAPI(extraStaff)
                              }
                              disabled={isSelected}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors",
                                isSelected
                                  ? "bg-slate-600/50 opacity-50 cursor-not-allowed"
                                  : "hover:bg-emerald-700/30 cursor-pointer"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {extraStaff.fullName}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                  {extraStaff.position || "Garson"} •{" "}
                                  {extraStaff.shiftStart || "17:00"}-
                                  {extraStaff.shiftEnd || "04:00"}
                                </p>
                              </div>
                              {isSelected ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs ml-2">
                                  Seçili
                                </Badge>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Manuel Ekstra Personel Ekleme */}
                <AccordionItem
                  value="extra"
                  className="border border-dashed border-slate-600 rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-3 py-2 hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-400">
                        Yeni Ekstra Personel
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <p className="text-xs text-slate-400 mb-3">
                      Sistemde kayıtlı olmayan personel ekleyin
                    </p>

                    {showExtraInput ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Ad Soyad"
                          value={extraName}
                          onChange={(e) => setExtraName(e.target.value)}
                          className="bg-slate-800 border-slate-600 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && extraName.trim()) {
                              handleAddExtraStaff();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={handleAddExtraStaff}
                          disabled={!extraName.trim()}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          Ekle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowExtraInput(false);
                            setExtraName("");
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowExtraInput(true)}
                        className="w-full border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ekstra Personel Ekle
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* Sağ Panel - Seçilen Personeller */}
          <div className="w-3/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="w-4 h-4" />
                Seçilen Personeller
                {selectedCount > 0 && (
                  <Badge className="bg-purple-500/20 text-purple-400">
                    {selectedCount}
                  </Badge>
                )}
              </h3>
            </div>

            {selectedCount === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Henüz personel seçilmedi</p>
                  <p className="text-xs mt-1">Soldan personel seçin</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {/* Görevlere göre gruplu gösterim */}
                {STAFF_ROLES.map((roleConfig) => {
                  const staffInRole = staffByRole[roleConfig.value] || [];
                  if (staffInRole.length === 0) return null;

                  return (
                    <div key={roleConfig.value} className="space-y-1">
                      {/* Görev Başlığı */}
                      <div
                        className="flex items-center gap-2 px-2 py-1 rounded-t-lg"
                        style={{ backgroundColor: `${roleConfig.color}20` }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: roleConfig.color }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: roleConfig.color }}
                        >
                          {roleConfig.label}
                        </span>
                        <Badge
                          className="text-[10px] px-1.5 py-0"
                          style={{
                            backgroundColor: `${roleConfig.color}30`,
                            color: roleConfig.color,
                          }}
                        >
                          {staffInRole.length}
                        </Badge>
                      </div>

                      {/* Personel Satırları */}
                      {staffInRole.map((row) => (
                        <div
                          key={row.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 border-l-2",
                            row.isExtra ? "bg-amber-500/10" : "bg-slate-700/30"
                          )}
                          style={{ borderLeftColor: roleConfig.color }}
                        >
                          {/* Görev Değiştir */}
                          <div className="w-24 flex-0 flex item-center justify-center">
                            <Select
                              value={row.role}
                              onValueChange={(v) =>
                                handleUpdateRow(row.id, "role", v)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs bg-slate-800 border-slate-600">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAFF_ROLES.map((role) => (
                                  <SelectItem
                                    key={role.value}
                                    value={role.value}
                                  >
                                    <div className="flex items-center justify-center  gap-2">
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

                          {/* Ad Soyad */}
                          <div className="w-36 flex-1 flex items-center justify-center">
                            <p
                              className="text-sm text-white truncate"
                              title={row.staffName}
                            >
                              {row.staffName}
                            </p>
                            {row.isExtra && (
                              <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                                Ekstra
                              </Badge>
                            )}
                          </div>

                          {/* Vardiya */}
                          <div className="flex-1 flex items-center justify-center gap-1">
                            {workShifts.length > 0 ? (
                              <Select
                                value={row.shiftId || "custom"}
                                onValueChange={(v) =>
                                  handleUpdateRow(row.id, "shiftId", v)
                                }
                              >
                                <SelectTrigger className="h-7 text-xs bg-slate-800 border-slate-600 w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {workShifts.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                      {shift.name} ({shift.startTime}-
                                      {shift.endTime})
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="custom">Özel</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <>
                                <Input
                                  type="time"
                                  value={row.shiftStart}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      row.id,
                                      "shiftStart",
                                      e.target.value
                                    )
                                  }
                                  className="h-7 text-xs bg-slate-800 border-slate-600 w-[90px]"
                                />
                                <span className="text-slate-500 text-xs">
                                  -
                                </span>
                                <Input
                                  type="time"
                                  value={row.shiftEnd}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      row.id,
                                      "shiftEnd",
                                      e.target.value
                                    )
                                  }
                                  className="h-7 text-xs bg-slate-800 border-slate-600 w-[90px]"
                                />
                              </>
                            )}
                          </div>

                          {/* Sil */}
                          <div className="flex-shrink-0 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveStaff(row.id)}
                              className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-700 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
          >
            İptal
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
            onKeyDown={(e) => {
              // Enter tuşunun WizardNavigation'a propagate olmasını engelle
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>Kaydet ({selectedCount} personel)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
