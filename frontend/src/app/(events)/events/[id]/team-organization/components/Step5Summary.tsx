"use client";

import { useState, useMemo, memo, useCallback } from "react";
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Users,
  Grid3X3,
  Layers,
  UserCheck,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { staffApi } from "@/lib/api";
import {
  TableGroup,
  TeamDefinition,
  TeamLeader,
  Staff,
  StaffRole,
  STAFF_ROLES,
  GroupStaffAssignment,
  ServicePoint,
  SERVICE_POINT_ROLES,
  SERVICE_POINT_TYPES,
  TableData,
} from "../types";
import { cn } from "@/lib/utils";

// Ekstra personel tipi
interface ExtraStaff {
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

interface Step5SummaryProps {
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  allStaff: Staff[];
  tables?: TableData[];
  servicePoints?: ServicePoint[];
  extraStaff?: ExtraStaff[];
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

// ==================== STAFF GROUP TYPE ====================
interface StaffGroupMember {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  roleColor: string;
  shiftStart: string;
  shiftEnd: string;
  position: string;
  workLocation: string;
  isExtra: boolean;
}

interface StaffGroup {
  groupNumber: number;
  groupName: string; // "Masa 45, 46" veya "Loca L1, L2"
  tableIds: string[];
  tableLabels: string[];
  isLoca: boolean;
  staff: StaffGroupMember[];
  // Orijinal tableGroup ID'leri (referans için)
  sourceGroupIds: string[];
}

// ==================== GROUPING LOGIC ====================
function computeStaffGroups(
  tableGroups: TableGroup[],
  allStaff: Staff[],
  tables: TableData[],
  extraStaff: ExtraStaff[],
): StaffGroup[] {
  // Resolve table labels helper
  const resolveTableLabel = (id: string): string => {
    let table = tables.find((t) => t.id === id);
    if (!table) table = tables.find((t) => t.label === id);
    if (!table) table = tables.find((t) => t.locaName === id);
    if (table?.isLoca) return table.locaName || table.label || id;
    if (table?.label) return table.label;
    return id;
  };

  // Resolve a table reference (id, label, or locaName) to actual table ID
  const resolveToTableId = (ref: string): string | null => {
    const byId = tables.find((t) => t.id === ref);
    if (byId) return byId.id;
    const byLabel = tables.find((t) => t.label === ref);
    if (byLabel) return byLabel.id;
    const byLocaName = tables.find(
      (t) =>
        t.locaName === ref || t.locaName?.toUpperCase() === ref.toUpperCase(),
    );
    if (byLocaName) return byLocaName.id;
    return null;
  };

  // tableIds'leri key olarak kullanarak grupla
  const keyMap = new Map<
    string,
    { tableIds: string[]; sourceGroupIds: string[]; staff: StaffGroupMember[] }
  >();

  // Track which table IDs are already covered by groups
  const coveredTableIds = new Set<string>();

  tableGroups.forEach((group) => {
    if (!group.staffAssignments || group.staffAssignments.length === 0) return;

    // Masa ID'lerini sırala ve key oluştur
    const sortedIds = [...group.tableIds].sort();
    const key = sortedIds.join("|");

    if (!keyMap.has(key)) {
      keyMap.set(key, { tableIds: sortedIds, sourceGroupIds: [], staff: [] });
    }

    const entry = keyMap.get(key)!;
    entry.sourceGroupIds.push(group.id);

    // Track covered tables
    group.tableIds.forEach((tid) => {
      coveredTableIds.add(tid);
      // Also resolve label-based IDs to actual IDs
      const resolved = resolveToTableId(tid);
      if (resolved) coveredTableIds.add(resolved);
    });

    // Personelleri ekle
    group.staffAssignments.forEach((a) => {
      // Duplicate kontrolu - ayni staff zaten eklenmisse atla
      if (entry.staff.some((s) => s.id === a.id)) return;
      const staff = allStaff.find((s) => s.id === a.staffId);
      const roleInfo = STAFF_ROLES.find((r) => r.value === a.role);
      entry.staff.push({
        id: a.id,
        name: a.staffName || staff?.fullName || "Bilinmeyen",
        role: a.role,
        roleLabel: roleInfo?.label || a.role,
        roleColor: roleInfo?.color || "#6b7280",
        shiftStart: a.shiftStart,
        shiftEnd: a.shiftEnd,
        position: staff?.position || "-",
        workLocation: staff?.workLocation || "-",
        isExtra: false,
      });
    });

    // Bu gruba atanmış ekstra personelleri ekle
    extraStaff.forEach((es) => {
      const isAssignedToGroup = es.assignedGroups?.includes(group.id);
      const isAssignedToTable =
        es.assignedTables &&
        es.assignedTables.length > 0 &&
        es.assignedTables.some((ref) => {
          const resolvedId = resolveToTableId(ref);
          return (
            group.tableIds.includes(ref) ||
            (resolvedId && group.tableIds.includes(resolvedId)) ||
            group.tableIds.some((gid) => resolveToTableId(gid) === resolvedId)
          );
        });

      if (isAssignedToGroup || isAssignedToTable) {
        // Duplicate kontrolü
        if (entry.staff.some((s) => s.id === es.id)) return;
        const roleInfo = STAFF_ROLES.find((r) => r.value === es.role);
        entry.staff.push({
          id: es.id,
          name: es.fullName,
          role: es.role || "waiter",
          roleLabel:
            (roleInfo?.label || es.role || es.position || "Garson") + " ★",
          roleColor: roleInfo?.color || es.color || "#f59e0b",
          shiftStart: es.shiftStart || "17:00",
          shiftEnd: es.shiftEnd || "04:00",
          position: es.position || "-",
          workLocation: es.workLocation || "Ekstra Personel",
          isExtra: true,
        });
      }
    });
  });

  // ==================== LOCA GRUPLARI EKLE ====================
  // Loca masalarını bul ve henüz bir grupta olmayan locaları ekle
  const locaTables = tables.filter((t) => t.isLoca);

  // ExtraStaff'ın assignedTables'ını resolve ederek loca grupları oluştur
  // Aynı assignedTables setine sahip extraStaff'ları grupla
  const locaExtraMap = new Map<
    string,
    { tableIds: string[]; staff: StaffGroupMember[] }
  >();

  extraStaff.forEach((es) => {
    if (!es.assignedTables || es.assignedTables.length === 0) return;

    // Resolve all table references to actual table IDs
    const resolvedIds: string[] = [];
    es.assignedTables.forEach((ref) => {
      const resolved = resolveToTableId(ref);
      if (resolved) {
        const table = tables.find((t) => t.id === resolved);
        if (table?.isLoca) resolvedIds.push(resolved);
      }
    });

    if (resolvedIds.length === 0) return;

    // Check if these loca tables are already covered by tableGroups
    const allCovered = resolvedIds.every((id) => coveredTableIds.has(id));
    if (allCovered) return; // Already in a group from tableGroups

    const sortedIds = [...resolvedIds].sort();
    const key = sortedIds.join("|");

    if (!locaExtraMap.has(key)) {
      locaExtraMap.set(key, { tableIds: sortedIds, staff: [] });
    }

    const entry = locaExtraMap.get(key)!;
    // Duplicate kontrolü
    if (entry.staff.some((s) => s.id === es.id)) return;

    const roleInfo = STAFF_ROLES.find((r) => r.value === es.role);
    entry.staff.push({
      id: es.id,
      name: es.fullName,
      role: es.role || "waiter",
      roleLabel: (roleInfo?.label || es.role || es.position || "Garson") + " ★",
      roleColor: roleInfo?.color || es.color || "#f59e0b",
      shiftStart: es.shiftStart || "17:00",
      shiftEnd: es.shiftEnd || "04:00",
      position: es.position || "-",
      workLocation: es.workLocation || "Ekstra Personel",
      isExtra: true,
    });
  });

  // Loca extra gruplarını keyMap'e ekle
  locaExtraMap.forEach((entry, key) => {
    if (!keyMap.has(key)) {
      keyMap.set(key, {
        tableIds: entry.tableIds,
        sourceGroupIds: [],
        staff: entry.staff,
      });
    } else {
      // Mevcut gruba ekle
      const existing = keyMap.get(key)!;
      entry.staff.forEach((s) => {
        if (!existing.staff.some((es) => es.id === s.id)) {
          existing.staff.push(s);
        }
      });
    }
    entry.tableIds.forEach((id) => coveredTableIds.add(id));
  });

  // Hâlâ hiçbir grupta olmayan loca masalarını boş grup olarak ekle
  locaTables.forEach((loca) => {
    if (!coveredTableIds.has(loca.id)) {
      const key = loca.id;
      keyMap.set(key, {
        tableIds: [loca.id],
        sourceGroupIds: [],
        staff: [],
      });
      coveredTableIds.add(loca.id);
    }
  });

  // Grupları oluştur ve numaralandır
  const groups: StaffGroup[] = [];
  let groupNum = 1;

  // Sıralama: önce normal masalar (numara sırasına göre), sonra localar
  const entries = Array.from(keyMap.values()).sort((a, b) => {
    const aIsLoca = a.tableIds.some((id) => {
      const t = tables.find((tt) => tt.id === id);
      return t?.isLoca;
    });
    const bIsLoca = b.tableIds.some((id) => {
      const t = tables.find((tt) => tt.id === id);
      return t?.isLoca;
    });

    // Normal masalar önce, localar sonra
    if (aIsLoca !== bIsLoca) return aIsLoca ? 1 : -1;

    const aFirst = resolveTableLabel(a.tableIds[0]);
    const bFirst = resolveTableLabel(b.tableIds[0]);
    const aNum = parseInt(aFirst.replace(/^L/i, ""));
    const bNum = parseInt(bFirst.replace(/^L/i, ""));
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return aFirst.localeCompare(bFirst, "tr");
  });

  entries.forEach((entry) => {
    const labels = entry.tableIds.map(resolveTableLabel).sort((a, b) => {
      const numA = parseInt(a.replace(/^L/i, ""));
      const numB = parseInt(b.replace(/^L/i, ""));
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, "tr");
    });

    const isLoca = entry.tableIds.some((id) => {
      const t = tables.find((tt) => tt.id === id);
      return t?.isLoca;
    });

    groups.push({
      groupNumber: groupNum,
      groupName: isLoca
        ? `Loca ${labels.join(", ")}`
        : `Masa ${labels.join(", ")}`,
      tableIds: entry.tableIds,
      tableLabels: labels,
      isLoca,
      staff: entry.staff,
      sourceGroupIds: entry.sourceGroupIds,
    });
    groupNum++;
  });

  return groups;
}

// ==================== STAT CARD ====================
interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
}

const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: StatCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
          {subValue && <p className="text-xs text-slate-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
});

// ==================== WARNING ITEM ====================
interface WarningItemProps {
  type: "error" | "warning" | "info";
  message: string;
}

const WarningItem = memo(function WarningItem({
  type,
  message,
}: WarningItemProps) {
  const config = {
    error: {
      icon: AlertCircle,
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
    },
    info: {
      icon: CheckCircle,
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
    },
  };
  const { icon: Icon, bg, border, text } = config[type];
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        bg,
        border,
      )}
    >
      <Icon className={cn("w-4 h-4 flex-shrink-0", text)} />
      <span className={cn("text-sm", text)}>{message}</span>
    </div>
  );
});

// ==================== GROUP BREAKDOWN ====================
interface GroupBreakdownProps {
  group: StaffGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

const GroupBreakdown = memo(function GroupBreakdown({
  group,
  isExpanded,
  onToggle,
}: GroupBreakdownProps) {
  const groupColor = group.isLoca ? "#a855f7" : "#3b82f6";

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: groupColor }}
        >
          {group.groupNumber}
        </div>
        <span className="font-semibold text-white">{group.groupName}</span>
        <div className="flex items-center gap-2 ml-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              group.isLoca
                ? "bg-purple-700/50 text-purple-300"
                : "bg-slate-700",
            )}
          >
            {group.isLoca
              ? `${group.tableLabels.length} alan`
              : `${group.tableLabels.length} masa`}
          </Badge>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge
            className={cn(
              "text-xs",
              group.staff.length > 0
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-amber-600/20 text-amber-400",
            )}
          >
            {group.staff.length} personel
          </Badge>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50">
          {group.staff.length === 0 ? (
            <span className="text-sm text-slate-500">
              Henüz personel atanmamış
            </span>
          ) : (
            <div className="border border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Görev
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Ad Soyad
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Masalar
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Unvan
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Görev Yeri
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-400">
                      Vardiya
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {group.staff.map((s, idx) => (
                    <tr
                      key={`${s.id}-${idx}`}
                      className={cn(
                        "transition-colors",
                        s.isExtra
                          ? "bg-amber-500/10 hover:bg-amber-500/20"
                          : "hover:bg-slate-700/20",
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.roleColor }}
                          />
                          <span
                            className={
                              s.isExtra ? "text-amber-300" : "text-slate-300"
                            }
                          >
                            {s.roleLabel}
                          </span>
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          s.isExtra ? "text-amber-200" : "text-white",
                        )}
                      >
                        {s.name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="text-slate-400 text-xs font-mono"
                          title={group.tableLabels.join(", ")}
                        >
                          {group.tableLabels.join(", ").length > 25
                            ? group.tableLabels.join(", ").substring(0, 25) +
                              "..."
                            : group.tableLabels.join(", ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{s.position}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {s.workLocation}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400">
                        {s.shiftStart} - {s.shiftEnd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== SERVICE POINT BREAKDOWN ====================
interface ServicePointBreakdownProps {
  servicePoint: ServicePoint;
  allStaff: Staff[];
  isExpanded: boolean;
  onToggle: () => void;
}

const ServicePointBreakdown = memo(function ServicePointBreakdown({
  servicePoint,
  allStaff,
  isExpanded,
  onToggle,
}: ServicePointBreakdownProps) {
  const assignments = servicePoint.staffAssignments || [];
  const totalAssigned = assignments.length;
  const pointTypeInfo = SERVICE_POINT_TYPES.find(
    (t) => t.value === servicePoint.pointType,
  );

  const staffList = useMemo(() => {
    return assignments.map((a) => {
      const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
      const roleInfo = SERVICE_POINT_ROLES.find((r) => r.value === a.role);
      return {
        id: a.id,
        name: staff?.fullName || "Bilinmeyen",
        role: roleInfo?.label || a.role,
        roleColor: roleInfo?.color || "#6b7280",
        position: staff?.position || "-",
        workLocation: staff?.workLocation || "-",
        shiftStart: a.shiftStart || "-",
        shiftEnd: a.shiftEnd || "-",
      };
    });
  }, [assignments, allStaff]);

  return (
    <div className="border border-cyan-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-700/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: servicePoint.color }}
        />
        <span className="font-semibold text-white">{servicePoint.name}</span>
        <Badge
          variant="secondary"
          className="bg-cyan-600/20 text-cyan-400 text-xs"
        >
          {pointTypeInfo?.label || servicePoint.pointType}
        </Badge>
        <div className="flex items-center gap-2 ml-auto">
          <Badge
            className={cn(
              "text-xs",
              totalAssigned >= servicePoint.requiredStaffCount
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-amber-600/20 text-amber-400",
            )}
          >
            {totalAssigned}/{servicePoint.requiredStaffCount} personel
          </Badge>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-cyan-700/30">
          {staffList.length === 0 ? (
            <span className="text-sm text-slate-500">
              Henüz personel atanmamış
            </span>
          ) : (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Görev
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Ad Soyad
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Unvan
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                      Görev Yeri
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-400">
                      Vardiya
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {staffList.map((staff) => (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: staff.roleColor }}
                          />
                          <span className="text-slate-300">{staff.role}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-white">{staff.name}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {staff.position}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {staff.workLocation}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400">
                        {staff.shiftStart} - {staff.shiftEnd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== EXCEL EXPORT (GRUP BAZLI) ====================
async function exportToExcel(
  staffGroups: StaffGroup[],
  servicePoints: ServicePoint[],
  allStaff: Staff[],
  tables: TableData[],
  extraStaff: ExtraStaff[],
  eventName?: string,
) {
  const XLSX = await import("xlsx");
  const data: Record<string, string>[] = [];

  // Grup bazlı personel listesi
  staffGroups.forEach((group) => {
    const masaLabel = group.isLoca
      ? `Loca ${group.tableLabels.join(", ")}`
      : group.tableLabels.join(", ");

    if (group.staff.length === 0) {
      data.push({
        Masalar: masaLabel,
        Görev: "-",
        "Ad Soyad": "-",
        Unvan: "-",
        "Görev Yeri": "-",
        "Vardiya Başlangıç": "-",
        "Vardiya Bitiş": "-",
      });
    } else {
      group.staff.forEach((s, idx) => {
        data.push({
          Masalar: idx === 0 ? masaLabel : "",
          Görev: s.roleLabel,
          "Ad Soyad": s.name,
          Unvan: s.position,
          "Görev Yeri": s.workLocation,
          "Vardiya Başlangıç": s.shiftStart,
          "Vardiya Bitiş": s.shiftEnd,
        });
      });
    }
  });

  // Hizmet Noktaları
  if (servicePoints.length > 0) {
    // Boş satır ayırıcı
    data.push({
      Masalar: "",
      Görev: "",
      "Ad Soyad": "",
      Unvan: "",
      "Görev Yeri": "",
      "Vardiya Başlangıç": "",
      "Vardiya Bitiş": "",
    });

    servicePoints.forEach((sp) => {
      const assignments = sp.staffAssignments || [];
      const pointTypeInfo = SERVICE_POINT_TYPES.find(
        (t) => t.value === sp.pointType,
      );

      if (assignments.length === 0) {
        data.push({
          Masalar: `📍 ${sp.name} (${pointTypeInfo?.label || sp.pointType})`,
          Görev: "-",
          "Ad Soyad": "-",
          Unvan: "-",
          "Görev Yeri": "-",
          "Vardiya Başlangıç": "-",
          "Vardiya Bitiş": "-",
        });
      } else {
        assignments.forEach((a, idx) => {
          const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
          const roleInfo = SERVICE_POINT_ROLES.find((r) => r.value === a.role);
          data.push({
            Masalar:
              idx === 0
                ? `📍 ${sp.name} (${pointTypeInfo?.label || sp.pointType})`
                : "",
            Görev: roleInfo?.label || a.role,
            "Ad Soyad": staff?.fullName || "Bilinmeyen",
            Unvan: staff?.position || "-",
            "Görev Yeri": staff?.workLocation || "-",
            "Vardiya Başlangıç": a.shiftStart || "-",
            "Vardiya Bitiş": a.shiftEnd || "-",
          });
        });
      }
    });
  }

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 30 }, // Masalar
    { wch: 14 }, // Görev
    { wch: 25 }, // Ad Soyad
    { wch: 20 }, // Unvan
    { wch: 20 }, // Görev Yeri
    { wch: 12 }, // Vardiya Başlangıç
    { wch: 12 }, // Vardiya Bitiş
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Personel Listesi");
  XLSX.writeFile(wb, `${eventName || "organizasyon"}_personel_listesi.xlsx`);
}

// ==================== PDF EXPORT (GRUP BAZLI) ====================
function exportToPDF(
  staffGroups: StaffGroup[],
  servicePoints: ServicePoint[],
  allStaff: Staff[],
  tables: TableData[],
  extraStaff: ExtraStaff[],
  eventName?: string,
  eventDate?: string,
) {
  const meritRoyalLogo = "/images/merit-royal-logo.png";
  const meritInternationalLogo = "/images/merit-international-logo.png";

  let content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Personel Organizasyonu - ${eventName || "Etkinlik"}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #333; margin: 0; padding: 0; }
    .header { 
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 15px; border-bottom: 3px solid #1a365d; padding: 10px 15px;
      background: linear-gradient(to right, #f8f9fa, #ffffff, #f8f9fa); border-radius: 5px;
    }
    .header-logo { width: 80px; height: auto; object-fit: contain; }
    .header-logo-left { width: 70px; height: auto; }
    .header-logo-right { width: 90px; height: auto; }
    .header-center { text-align: center; flex: 1; padding: 0 20px; }
    .header-center h1 { margin: 0 0 4px 0; font-size: 18px; color: #1a365d; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .header-center p { margin: 0; color: #666; font-size: 11px; }
    .header-divider { width: 100%; height: 2px; background: linear-gradient(to right, #d4af37, #1a365d, #d4af37); margin: 10px 0; }
    .section-title {
      background: linear-gradient(135deg, #1a365d 0%, #2d4a6f 100%);
      color: white; padding: 8px 12px; font-size: 11px; font-weight: bold;
      margin: 15px 0 10px 0; border-radius: 4px; border-left: 4px solid #d4af37;
    }
    .group-section { margin-bottom: 12px; page-break-inside: avoid; }
    .group-header {
      background: linear-gradient(to right, #f0f0f0, #fafafa);
      padding: 8px 12px; border-radius: 4px; margin-bottom: 6px;
      display: flex; align-items: center; gap: 8px; border-left: 4px solid #3b82f6;
    }
    .group-number {
      width: 24px; height: 24px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 11px;
      font-weight: bold; color: white; flex-shrink: 0;
    }
    .group-name { font-weight: bold; font-size: 12px; color: #1a365d; }
    .group-tables { font-size: 9px; color: #666; font-family: monospace; margin-left: 8px; }
    .group-stats { margin-left: auto; font-size: 9px; color: #666; background: #e8e8e8; padding: 2px 8px; border-radius: 10px; }
    .service-point-color { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .point-type { background: #e0f7fa; color: #00838f; padding: 2px 6px; border-radius: 3px; font-size: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: linear-gradient(to bottom, #1a365d, #2d4a6f); color: white; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px; border: 1px solid #1a365d; }
    td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) { background: #f8f9fa; }
    .role-badge { display: inline-flex; align-items: center; gap: 3px; }
    .role-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .shift-time { font-family: monospace; font-size: 8px; }
    .footer {
      margin-top: 20px; text-align: center; font-size: 8px; color: #666;
      border-top: 2px solid #1a365d; padding-top: 10px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .footer-logo { width: 50px; height: auto; opacity: 0.7; }
    .footer-text { flex: 1; text-align: center; }
    .no-staff { color: #999; font-style: italic; padding: 8px; text-align: center; font-size: 9px; }
    .gold-accent { color: #d4af37; }
    .extra-row { background: #fffbeb !important; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${meritInternationalLogo}" alt="Merit International" class="header-logo header-logo-left" onerror="this.style.display='none'">
    <div class="header-center">
      <h1>${eventName || "Etkinlik"}</h1>
      <p>Personel Organizasyonu</p>
      <p style="margin-top: 4px; font-size: 10px; color: #1a365d;">${
        eventDate
          ? new Date(eventDate).toLocaleDateString("tr-TR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : new Date().toLocaleDateString("tr-TR")
      }</p>
    </div>
    <img src="${meritRoyalLogo}" alt="Merit Royal" class="header-logo header-logo-right" onerror="this.style.display='none'">
  </div>
  <div class="header-divider"></div>
`;

  // Gruplar Bölümü
  if (staffGroups.length > 0) {
    content += `<div class="section-title">📋 Personel Atamaları (${staffGroups.length} Bölüm)</div>`;

    staffGroups.forEach((group) => {
      const bgColor = group.isLoca ? "#a855f7" : "#3b82f6";
      const borderColor = group.isLoca ? "#a855f7" : "#3b82f6";
      const locaBadge = group.isLoca
        ? `<span style="background: #a855f7; color: white; padding: 1px 6px; border-radius: 3px; font-size: 8px; margin-left: 6px;">LOCA</span>`
        : "";

      // Grup ismi yerine sadece masa numaralarını göster
      const displayTitle = group.isLoca
        ? `Loca ${group.tableLabels.join(", ")}`
        : `Masa ${group.tableLabels.join(", ")}`;

      content += `
  <div class="group-section">
    <div class="group-header" style="border-left-color: ${borderColor}">
      <div class="group-number" style="background: ${bgColor}">${group.groupNumber}</div>
      <span class="group-name">${displayTitle}</span>${locaBadge}
      <span class="group-stats">${group.staff.length} personel</span>
    </div>
`;

      if (group.staff.length === 0) {
        content += `<div class="no-staff">Henüz personel atanmamış</div>`;
      } else {
        content += `
    <table>
      <thead>
        <tr>
          <th style="width: 15%">Görev</th>
          <th style="width: 25%">Ad Soyad</th>
          <th style="width: 20%">Unvan</th>
          <th style="width: 20%">Görev Yeri</th>
          <th style="width: 10%">Başlangıç</th>
          <th style="width: 10%">Bitiş</th>
        </tr>
      </thead>
      <tbody>
`;

        group.staff.forEach((s) => {
          content += `
        <tr${s.isExtra ? ' class="extra-row"' : ""}>
          <td>
            <span class="role-badge">
              <span class="role-dot" style="background: ${s.roleColor}"></span>
              ${s.roleLabel}
            </span>
          </td>
          <td>${s.name}</td>
          <td>${s.position}</td>
          <td>${s.workLocation}</td>
          <td class="shift-time">${s.shiftStart}</td>
          <td class="shift-time">${s.shiftEnd}</td>
        </tr>
`;
        });

        content += `
      </tbody>
    </table>
`;
      }

      content += `</div>`;
    });
  }

  // Hizmet Noktaları
  if (servicePoints.length > 0) {
    content += `<div class="section-title">📍 Hizmet Noktaları</div>`;

    servicePoints.forEach((sp) => {
      const assignments = sp.staffAssignments || [];
      const pointTypeInfo = SERVICE_POINT_TYPES.find(
        (t) => t.value === sp.pointType,
      );

      content += `
  <div class="group-section">
    <div class="group-header">
      <div class="service-point-color" style="background: ${sp.color}"></div>
      <span class="group-name">${sp.name}</span>
      <span class="point-type">${pointTypeInfo?.label || sp.pointType}</span>
      <span class="group-stats">${assignments.length}/${sp.requiredStaffCount} personel</span>
    </div>
`;

      if (assignments.length === 0) {
        content += `<div class="no-staff">Henüz personel atanmamış</div>`;
      } else {
        content += `
    <table>
      <thead>
        <tr>
          <th style="width: 20%">Görev</th>
          <th style="width: 40%">Ad Soyad</th>
          <th style="width: 20%">Başlangıç</th>
          <th style="width: 20%">Bitiş</th>
        </tr>
      </thead>
      <tbody>
`;

        assignments.forEach((a) => {
          const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
          const roleInfo = SERVICE_POINT_ROLES.find((r) => r.value === a.role);
          content += `
        <tr>
          <td><span class="role-badge"><span class="role-dot" style="background: ${roleInfo?.color || "#666"}"></span>${roleInfo?.label || a.role}</span></td>
          <td>${staff?.fullName || "Bilinmeyen"}</td>
          <td class="shift-time">${a.shiftStart || "-"}</td>
          <td class="shift-time">${a.shiftEnd || "-"}</td>
        </tr>
`;
        });

        content += `</tbody></table>`;
      }

      content += `</div>`;
    });
  }

  content += `
  <div class="footer">
    <img src="${meritInternationalLogo}" alt="Merit" class="footer-logo" onerror="this.style.display='none'">
    <div class="footer-text">
      <span class="gold-accent">★</span> Oluşturulma: ${new Date().toLocaleString("tr-TR")} <span class="gold-accent">★</span><br>
      <span style="color: #1a365d; font-weight: bold;">EventFlow PRO</span> - Merit Royal Hotel & Casino & SPA
    </div>
    <img src="${meritRoyalLogo}" alt="Merit Royal" class="footer-logo" onerror="this.style.display='none'">
  </div>
</body>
</html>
`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

// ==================== MAIN COMPONENT ====================
export function Step5Summary({
  tableGroups,
  teams,
  allStaff,
  tables = [],
  servicePoints = [],
  extraStaff = [],
  eventId,
  eventName,
  eventDate,
  onExportPDF,
  onExportExcel,
}: Step5SummaryProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [expandedServicePoints, setExpandedServicePoints] = useState<
    Set<string>
  >(new Set());

  // Şablon kaydetme state'leri
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Otomatik gruplama: aynı masalara atanmış personelleri birleştir
  const staffGroups = useMemo(
    () => computeStaffGroups(tableGroups, allStaff, tables, extraStaff),
    [tableGroups, allStaff, tables, extraStaff],
  );

  const toggleGroup = useCallback((groupNum: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupNum)) next.delete(groupNum);
      else next.add(groupNum);
      return next;
    });
  }, []);

  const toggleServicePoint = useCallback((spId: string) => {
    setExpandedServicePoints((prev) => {
      const next = new Set(prev);
      if (next.has(spId)) next.delete(spId);
      else next.add(spId);
      return next;
    });
  }, []);

  // Export handlers
  const handleExportExcel = useCallback(async () => {
    await exportToExcel(
      staffGroups,
      servicePoints,
      allStaff,
      tables,
      extraStaff,
      eventName,
    );
    onExportExcel?.();
  }, [
    staffGroups,
    servicePoints,
    allStaff,
    tables,
    extraStaff,
    eventName,
    onExportExcel,
  ]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(
      staffGroups,
      servicePoints,
      allStaff,
      tables,
      extraStaff,
      eventName,
      eventDate,
    );
    onExportPDF?.();
  }, [
    staffGroups,
    servicePoints,
    allStaff,
    tables,
    extraStaff,
    eventName,
    eventDate,
    onExportPDF,
  ]);

  // Şablon olarak kaydet
  const handleSaveAsTemplate = useCallback(async () => {
    if (!templateName.trim() || !eventId) return;
    setSavingTemplate(true);
    try {
      await staffApi.createOrganizationTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        eventId,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setShowSaveTemplateModal(false);
        setSaveSuccess(false);
        setTemplateName("");
        setTemplateDescription("");
      }, 1500);
    } catch (error) {
      console.error("Şablon kaydedilemedi:", error);
      alert("Şablon kaydedilirken bir hata oluştu");
    } finally {
      setSavingTemplate(false);
    }
  }, [templateName, templateDescription, eventId]);

  const handleOpenSaveTemplateModal = useCallback(() => {
    setTemplateName(eventName ? `${eventName} Şablonu` : "Yeni Şablon");
    setTemplateDescription("");
    setSaveSuccess(false);
    setShowSaveTemplateModal(true);
  }, [eventName]);

  // Stats
  const stats = useMemo(() => {
    const totalStaff = staffGroups.reduce((sum, g) => sum + g.staff.length, 0);
    const totalTables = new Set(staffGroups.flatMap((g) => g.tableIds)).size;
    const locaGroups = staffGroups.filter((g) => g.isLoca);
    const normalGroups = staffGroups.filter((g) => !g.isLoca);
    const servicePointStaffCount = servicePoints.reduce(
      (sum, sp) => sum + (sp.staffAssignments?.length || 0),
      0,
    );

    return {
      totalGroups: staffGroups.length,
      normalGroupCount: normalGroups.length,
      locaGroupCount: locaGroups.length,
      totalTables,
      totalStaff: totalStaff + servicePointStaffCount,
      servicePointsCount: servicePoints.length,
      servicePointStaffCount,
    };
  }, [staffGroups, servicePoints]);

  // Warnings
  const warnings = useMemo(() => {
    const list: { type: "error" | "warning" | "info"; message: string }[] = [];

    const emptyGroups = staffGroups.filter((g) => g.staff.length === 0);
    if (emptyGroups.length > 0) {
      list.push({
        type: "error",
        message: `${emptyGroups.length} gruba personel atanmamış`,
      });
    }

    const servicePointsWithoutStaff = servicePoints.filter(
      (sp) => !sp.staffAssignments || sp.staffAssignments.length === 0,
    );
    if (servicePointsWithoutStaff.length > 0) {
      list.push({
        type: "warning",
        message: `${servicePointsWithoutStaff.length} hizmet noktasına personel atanmamış`,
      });
    }

    if (list.length === 0) {
      list.push({ type: "info", message: "Tüm atamalar tamamlandı!" });
    }

    return list;
  }, [staffGroups, servicePoints]);

  const hasErrors = warnings.some((w) => w.type === "error");
  const hasWarnings = warnings.some((w) => w.type === "warning");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Özet</h2>
          <p className="text-sm text-slate-400">
            Aynı masalara atanmış personeller otomatik gruplanır
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSaveTemplateModal}
            className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
            disabled={tableGroups.length === 0}
          >
            <Save className="w-4 h-4 mr-1.5" />
            Şablon Kaydet
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="border-red-600 text-red-400 hover:bg-red-600/20"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={Layers}
          label="Grup"
          value={stats.normalGroupCount}
          color="#3b82f6"
        />
        <StatCard
          icon={Layers}
          label="Loca"
          value={stats.locaGroupCount}
          color="#a855f7"
        />
        <StatCard
          icon={Grid3X3}
          label="Masa"
          value={stats.totalTables}
          color="#22c55e"
        />
        <StatCard
          icon={UserCheck}
          label="Personel"
          value={stats.totalStaff}
          color="#f59e0b"
        />
        <StatCard
          icon={MapPin}
          label="Hizmet Noktası"
          value={stats.servicePointsCount}
          subValue={`${stats.servicePointStaffCount} personel`}
          color="#06b6d4"
        />
      </div>

      {/* Warnings */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          {hasErrors ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : hasWarnings ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          Durum Kontrolleri
        </h3>
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <WarningItem
              key={index}
              type={warning.type}
              message={warning.message}
            />
          ))}
        </div>
      </div>

      {/* Group Breakdown */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-2">
          Personel Grupları ({staffGroups.length})
        </h3>
        {staffGroups.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Henüz personel ataması yapılmamış</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staffGroups.map((group) => (
              <GroupBreakdown
                key={group.groupNumber}
                group={group}
                isExpanded={expandedGroups.has(group.groupNumber)}
                onToggle={() => toggleGroup(group.groupNumber)}
              />
            ))}
          </div>
        )}

        {/* Service Points */}
        {servicePoints.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-white mb-2 mt-6 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">
                📍
              </span>
              Hizmet Noktaları
            </h3>
            <div className="space-y-2">
              {servicePoints.map((sp) => (
                <ServicePointBreakdown
                  key={sp.id}
                  servicePoint={sp}
                  allStaff={allStaff}
                  isExpanded={expandedServicePoints.has(sp.id)}
                  onToggle={() => toggleServicePoint(sp.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Completion Status */}
      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!hasErrors && !hasWarnings ? (
              <>
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-medium text-emerald-400">
                    Organizasyon Tamamlandı
                  </p>
                  <p className="text-xs text-slate-500">
                    Tüm atamalar yapıldı, kaydedebilirsiniz
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-400">
                    Eksik Atamalar Var
                  </p>
                  <p className="text-xs text-slate-500">
                    Yukarıdaki uyarıları kontrol edin
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              {staffGroups.length}
            </p>
            <p className="text-xs text-slate-500">Grup</p>
          </div>
        </div>
      </div>

      {/* Şablon Olarak Kaydet Modal */}
      <Dialog
        open={showSaveTemplateModal}
        onOpenChange={setShowSaveTemplateModal}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-400" />
              Şablon Olarak Kaydet
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Bu organizasyonu şablon olarak kaydedin. Daha sonra başka
              etkinliklerde kullanabilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {saveSuccess ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="text-lg font-medium text-emerald-400">
                  Şablon Kaydedildi!
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Ekip Şablonları bölümünden erişebilirsiniz
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">
                    Şablon Adı *
                  </label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Örn: Düğün Organizasyonu"
                    className="bg-slate-700 border-slate-600"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">
                    Açıklama (Opsiyonel)
                  </label>
                  <Input
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Şablon hakkında kısa açıklama..."
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-slate-400">
                    Şablona dahil edilecek:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-blue-600/20 text-blue-400"
                    >
                      {staffGroups.length} Grup
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-amber-600/20 text-amber-400"
                    >
                      {stats.totalStaff} Personel Ataması
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>

          {!saveSuccess && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSaveTemplateModal(false)}
                className="border-slate-600"
                disabled={savingTemplate}
              >
                İptal
              </Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    Kaydet
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
