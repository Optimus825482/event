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
  Users,
  Loader2,
  Plus,
  Wine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Staff,
  WorkShift,
  ServicePoint,
  ServicePointStaffAssignment,
  SERVICE_POINT_ROLES,
} from "../types";

// Seçilen personel satırı tipi
interface SelectedStaffRow {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  shiftId: string | null;
  shiftStart: string;
  shiftEnd: string;
  position: string;
  department: string;
  isExtra: boolean;
}

interface ServicePointStaffModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (assignments: ServicePointStaffAssignment[]) => void;
  servicePoint: ServicePoint;
  allStaff: Staff[];
  workShifts: WorkShift[];
  existingAssignments?: ServicePointStaffAssignment[];
  isLoading?: boolean;
}

export function ServicePointStaffModal({
  open,
  onClose,
  onSave,
  servicePoint,
  allStaff,
  workShifts,
  existingAssignments = [],
  isLoading = false,
}: ServicePointStaffModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<SelectedStaffRow[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Ekstra personel ekleme
  const [showExtraInput, setShowExtraInput] = useState(false);
  const [extraName, setExtraName] = useState("");

  // Early return - modal kapalıysa veya servicePoint yoksa render etme
  // Bu infinite loop'u önler
  const isValidServicePoint =
    servicePoint && servicePoint.id && servicePoint.name;

  // Mevcut atamaları yükle - sadece servicePoint.id değiştiğinde çalış
  // NOT: existingAssignments ve allStaff dependency'den çıkarıldı çünkü her render'da
  // yeni referans alıyor ve bu selectedStaff'ı sıfırlıyordu
  useEffect(() => {
    if (!open || !isValidServicePoint) return;

    // State'i sıfırla
    setSearchQuery("");
    setShowExtraInput(false);
    setExtraName("");

    if (existingAssignments && existingAssignments.length > 0) {
      const rows: SelectedStaffRow[] = existingAssignments.map((a) => {
        const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
        const isExtra = a.staffId.startsWith("extra-");

        return {
          id: a.id,
          staffId: a.staffId,
          staffName: isExtra
            ? "Ekstra Personel"
            : staff?.fullName || "Bilinmeyen",
          role: a.role,
          shiftId: a.shiftId || null,
          shiftStart: a.shiftStart || "18:00",
          shiftEnd: a.shiftEnd || "02:00",
          position: staff?.position || "",
          department: staff?.department || "",
          isExtra,
        };
      });
      setSelectedStaff(rows);
    } else {
      setSelectedStaff([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, servicePoint?.id]); // existingAssignments ve allStaff dependency'den çıkarıldı

  // İzin verilen rollere göre personelleri filtrele
  const allowedRoles = isValidServicePoint
    ? servicePoint.allowedRoles || []
    : [];

  // Personelleri rollere göre grupla
  const staffByRole = useMemo(() => {
    const result: Record<string, Staff[]> = {};

    SERVICE_POINT_ROLES.forEach((roleConfig) => {
      if (allowedRoles.includes(roleConfig.value)) {
        result[roleConfig.value] = allStaff.filter((s) => {
          const pos = s.position?.toLowerCase() || "";
          // Pozisyona göre eşleştir
          if (roleConfig.value === "barman") {
            return (
              pos.includes("barmen") ||
              pos.includes("barman") ||
              pos.includes("bartender")
            );
          }
          if (roleConfig.value === "hostes") {
            return (
              pos.includes("hostes") ||
              pos.includes("hostess") ||
              pos.includes("host")
            );
          }
          if (roleConfig.value === "garson") {
            return pos.includes("garson") || pos.includes("waiter");
          }
          if (roleConfig.value === "barboy") {
            return pos.includes("barboy") || pos.includes("bar boy");
          }
          if (roleConfig.value === "security") {
            return pos.includes("güvenlik") || pos.includes("security");
          }
          if (roleConfig.value === "runner") {
            return (
              pos.includes("komi") ||
              pos.includes("runner") ||
              pos.includes("commis")
            );
          }
          if (roleConfig.value === "supervisor") {
            return (
              pos.includes("süpervizör") ||
              pos.includes("supervisor") ||
              pos.includes("şef")
            );
          }
          return false;
        });
      }
    });

    return result;
  }, [allStaff, allowedRoles]);

  // Arama filtresi
  const filteredStaffByRole = useMemo(() => {
    if (!searchQuery.trim()) return staffByRole;

    const query = searchQuery.toLowerCase();
    const result: Record<string, Staff[]> = {};

    Object.entries(staffByRole).forEach(([key, staffList]) => {
      result[key] = staffList.filter(
        (s) =>
          s.fullName.toLowerCase().includes(query) ||
          s.position?.toLowerCase().includes(query)
      );
    });

    return result;
  }, [staffByRole, searchQuery]);

  // Personel seç
  const handleSelectStaff = useCallback(
    (staff: Staff, role: string) => {
      if (selectedStaff.some((s) => s.staffId === staff.id)) return;

      const defaultShift = workShifts.length > 0 ? workShifts[0] : null;

      const newRow: SelectedStaffRow = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        staffId: staff.id,
        staffName: staff.fullName,
        role,
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

  // Ekstra personel ekle
  const handleAddExtraStaff = useCallback(() => {
    if (!extraName.trim()) return;

    const defaultShift = workShifts.length > 0 ? workShifts[0] : null;
    const defaultRole = allowedRoles[0] || "garson";

    const newRow: SelectedStaffRow = {
      id: `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      staffId: `extra-${Date.now()}`,
      staffName: extraName.trim(),
      role: defaultRole,
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
  }, [extraName, workShifts, allowedRoles]);

  // Kaydet
  const handleSave = useCallback(() => {
    if (!isValidServicePoint) return;

    const assignments: ServicePointStaffAssignment[] = selectedStaff.map(
      (s) => ({
        id:
          s.id.startsWith("temp-") || s.id.startsWith("extra-")
            ? `sp-assign-${Date.now()}-${Math.random().toString(36).slice(2)}`
            : s.id,
        eventId: servicePoint.eventId,
        servicePointId: servicePoint.id,
        staffId: s.staffId,
        role: s.role,
        shiftId: s.shiftId || undefined,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        sortOrder: 0,
        isActive: true,
      })
    );

    onSave(assignments);
  }, [selectedStaff, servicePoint, onSave, isValidServicePoint]);

  // Seçili personel sayısı
  const selectedCount = selectedStaff.length;

  // Seçilen personelleri role göre grupla
  const selectedByRole = useMemo(() => {
    const grouped: Record<string, SelectedStaffRow[]> = {};
    selectedStaff.forEach((staff) => {
      if (!grouped[staff.role]) {
        grouped[staff.role] = [];
      }
      grouped[staff.role].push(staff);
    });
    return grouped;
  }, [selectedStaff]);

  // Modal kapanma handler'ı - debounce için zaman kaydı
  const handleDialogClose = useCallback(
    (openState: boolean) => {
      if (!openState) {
        // Modal kapanma zamanını kaydet (WizardNavigation'da Enter key debounce için)
        (window as any).__lastModalCloseTime = Date.now();
        onClose();
      }
    },
    [onClose]
  );

  // ServicePoint geçerli değilse modal'ı render etme
  if (!isValidServicePoint) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent
        className="bg-slate-800 border-slate-700 overflow-hidden flex flex-col"
        style={{ maxWidth: "1100px", width: "95vw", maxHeight: "85vh" }}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${servicePoint.color}20` }}
            >
              <Wine className="w-4 h-4" style={{ color: servicePoint.color }} />
            </div>
            <span style={{ color: servicePoint.color }}>
              {servicePoint.name}
            </span>
            <span className="text-slate-400 font-normal">
              - Personel Ataması
            </span>
          </DialogTitle>
          {/* Bilgi */}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span>Gerekli: {servicePoint.requiredStaffCount} personel</span>
            <span>•</span>
            <span>Atanan: {selectedCount} personel</span>
            {selectedCount < servicePoint.requiredStaffCount && (
              <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                {servicePoint.requiredStaffCount - selectedCount} eksik
              </Badge>
            )}
            {selectedCount >= servicePoint.requiredStaffCount && (
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                Tamamlandı
              </Badge>
            )}
          </div>
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

            {/* Accordion Roller */}
            <div className="flex-1 overflow-y-auto">
              <Accordion
                type="multiple"
                value={expandedCategories}
                onValueChange={setExpandedCategories}
                className="space-y-2"
              >
                {SERVICE_POINT_ROLES.filter((role) =>
                  allowedRoles.includes(role.value)
                ).map((roleConfig) => {
                  const staffList = filteredStaffByRole[roleConfig.value] || [];
                  const selectedInRole = selectedStaff.filter(
                    (s) =>
                      !s.isExtra &&
                      staffByRole[roleConfig.value]?.some(
                        (st) => st.id === s.staffId
                      )
                  ).length;

                  return (
                    <AccordionItem
                      key={roleConfig.value}
                      value={roleConfig.value}
                      className="border border-slate-700 rounded-lg overflow-hidden"
                    >
                      <AccordionTrigger className="px-3 py-2 hover:bg-slate-700/50 [&[data-state=open]]:bg-slate-700/30">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: roleConfig.color }}
                          />
                          <span className="text-sm font-medium">
                            {roleConfig.label}
                          </span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {staffList.length}
                          </Badge>
                          {selectedInRole > 0 && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                              {selectedInRole} seçili
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-2">
                        {staffList.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2 text-center">
                            Bu rolde personel yok
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
                                    handleSelectStaff(staff, roleConfig.value)
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
                                      {staff.position}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 text-xs ml-2">
                                      Seçili
                                    </Badge>
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

                {/* Ekstra Personel */}
                <AccordionItem
                  value="extra"
                  className="border border-dashed border-slate-600 rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-3 py-2 hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-400">
                        Ekstra Personel
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
                Atanan Personeller
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
                  <p className="text-sm">Henüz personel atanmadı</p>
                  <p className="text-xs mt-1">Soldan personel seçin</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {/* Rollere göre gruplu gösterim */}
                {SERVICE_POINT_ROLES.map((roleConfig) => {
                  const staffInRole = selectedByRole[roleConfig.value] || [];
                  if (staffInRole.length === 0) return null;

                  return (
                    <div key={roleConfig.value} className="space-y-1">
                      {/* Rol Başlığı */}
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
                          <div className="w-24 flex-shrink-0">
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
                                {SERVICE_POINT_ROLES.filter((r) =>
                                  allowedRoles.includes(r.value)
                                ).map((role) => (
                                  <SelectItem
                                    key={role.value}
                                    value={role.value}
                                  >
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

                          {/* Ad Soyad */}
                          <div className="w-36 flex-shrink-0">
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
                          <div className="flex-1 flex items-center justify-end gap-1">
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
                          <div className="flex-shrink-0">
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
            onClick={handleSave}
            disabled={isLoading}
            className="bg-cyan-600 hover:bg-cyan-700"
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
