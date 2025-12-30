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
  Staff,
  STAFF_ROLES,
  GroupStaffAssignment,
  ServicePoint,
  SERVICE_POINT_ROLES,
  SERVICE_POINT_TYPES,
  TableData,
} from "../types";
import { cn } from "@/lib/utils";

interface Step5SummaryProps {
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  allStaff: Staff[];
  tables?: TableData[];
  servicePoints?: ServicePoint[];
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
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
        border
      )}
    >
      <Icon className={cn("w-4 h-4 flex-shrink-0", text)} />
      <span className={cn("text-sm", text)}>{message}</span>
    </div>
  );
});

// ==================== TEAM BREAKDOWN ====================
interface TeamBreakdownProps {
  team: TeamDefinition;
  groups: TableGroup[];
  allStaff: Staff[];
  tables?: TableData[];
  isExpanded: boolean;
  onToggle: () => void;
}

const TeamBreakdown = memo(function TeamBreakdown({
  team,
  groups,
  allStaff,
  tables = [],
  isExpanded,
  onToggle,
}: TeamBreakdownProps) {
  const totalTables = groups.reduce((sum, g) => sum + g.tableIds.length, 0);
  const allAssignments = groups.flatMap((g) => g.staffAssignments || []);
  const totalAssigned = allAssignments.length;

  // Personel listesi - grup, masa numaraları/loca adları, rol, vardiya, görev yeri ve unvan bilgisiyle
  const staffList = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      role: string;
      roleColor: string;
      position: string;
      workLocation: string;
      shiftStart: string;
      shiftEnd: string;
      groupName: string;
      groupColor: string;
      tableNumbers: string;
    }> = [];

    groups.forEach((group) => {
      const assignments = group.staffAssignments || [];
      // Masa numaralarını veya loca adlarını çıkar
      const tableLabels = group.tableIds
        .map((id) => {
          // Masa verisini bul
          const table = tables.find((t) => t.id === id);
          // Loca ise loca adını veya label'ı göster
          if (table?.isLoca) {
            return table.locaName || table.label || id;
          }
          // Normal masa - label varsa kullan, yoksa ID'den çıkar
          if (table?.label) {
            return table.label;
          }
          // ID'nin sonundaki sayıyı al (son tire'den sonraki kısım)
          const match = id.match(/-(\d+)$/);
          return match ? match[1] : id;
        })
        .sort((a, b) => {
          // Sayısal olanları sayısal sırala, metinsel olanları alfabetik
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b, "tr");
        })
        .join(", ");

      assignments.forEach((a) => {
        // Önce assignment'taki staffName'i kontrol et, yoksa allStaff'tan bul
        const staff = allStaff.find((s) => s.id === a.staffId);
        const staffName = a.staffName || staff?.fullName || "Bilinmeyen";
        const roleInfo = STAFF_ROLES.find((r) => r.value === a.role);
        list.push({
          id: a.id,
          name: staffName,
          role: roleInfo?.label || a.role,
          roleColor: roleInfo?.color || "#6b7280",
          position: staff?.position || "-",
          workLocation: staff?.workLocation || "-",
          shiftStart: a.shiftStart,
          shiftEnd: a.shiftEnd,
          groupName: group.name,
          groupColor: group.color,
          tableNumbers: tableLabels,
        });
      });
    });

    return list;
  }, [groups, allStaff, tables]);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Header - Clickable */}
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
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <span className="font-semibold text-white">{team.name}</span>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="bg-slate-700 text-xs">
            {groups.length} grup
          </Badge>
          <Badge variant="secondary" className="bg-slate-700 text-xs">
            {totalTables} masa
          </Badge>
          <Badge
            className={cn(
              "text-xs",
              totalAssigned > 0
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-amber-600/20 text-amber-400"
            )}
          >
            {totalAssigned} personel
          </Badge>
        </div>
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50">
          <div className="space-y-3">
            {/* Groups */}
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Atanan Gruplar</p>
              <div className="flex flex-wrap gap-1.5">
                {groups.length === 0 ? (
                  <span className="text-sm text-slate-500">Grup atanmamış</span>
                ) : (
                  groups.map((group) => (
                    <Badge
                      key={group.id}
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: group.color, color: group.color }}
                    >
                      {group.name} ({group.tableIds.length} masa,{" "}
                      {group.staffAssignments?.length || 0} personel)
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Staff Table */}
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Personel Listesi</p>
              {staffList.length === 0 ? (
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
                          Grup (Masalar)
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
                              <span className="text-slate-300">
                                {staff.role}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-white">{staff.name}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: staff.groupColor }}
                                />
                                <span className="text-slate-300 text-xs font-medium">
                                  {staff.groupName}
                                </span>
                              </div>
                              <span
                                className="text-slate-500 text-[10px] font-mono pl-3.5"
                                title={staff.tableNumbers}
                              >
                                {staff.tableNumbers.length > 20
                                  ? staff.tableNumbers.substring(0, 20) + "..."
                                  : staff.tableNumbers}
                              </span>
                            </div>
                          </td>
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
          </div>
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
    (t) => t.value === servicePoint.pointType
  );

  // Personel listesi
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
      {/* Header - Clickable */}
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
                : "bg-amber-600/20 text-amber-400"
            )}
          >
            {totalAssigned}/{servicePoint.requiredStaffCount} personel
          </Badge>
        </div>
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-cyan-700/30">
          <div className="space-y-3">
            {/* Allowed Roles */}
            <div>
              <p className="text-xs text-slate-500 mb-1.5">
                İzin Verilen Görevler
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(servicePoint.allowedRoles || []).map((role) => {
                  const roleInfo = SERVICE_POINT_ROLES.find(
                    (r) => r.value === role
                  );
                  return (
                    <Badge
                      key={role}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: roleInfo?.color || "#6b7280",
                        color: roleInfo?.color || "#6b7280",
                      }}
                    >
                      {roleInfo?.label || role}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Staff Table */}
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Personel Listesi</p>
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
                              <span className="text-slate-300">
                                {staff.role}
                              </span>
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
          </div>
        </div>
      )}
    </div>
  );
});

// ==================== EXPORT HELPERS ====================

// Excel Export - XLSX formatında biçimlendirilmiş tablo
// LAZY LOAD: xlsx kütüphanesi sadece export sırasında yüklenir (~1.2MB tasarruf)
async function exportToExcel(
  teams: TeamDefinition[],
  tableGroups: TableGroup[],
  allStaff: Staff[],
  tables: TableData[],
  servicePoints: ServicePoint[],
  eventName?: string
) {
  // Dynamic import - xlsx sadece gerektiğinde yüklenir
  const XLSX = await import("xlsx");
  // Veri hazırla - Takımlar
  const data: Record<string, string>[] = [];

  // Sadece gruba atanmış takımları filtrele
  const teamsWithGroups = teams.filter((team) =>
    tableGroups.some((g) => g.assignedTeamId === team.id)
  );

  teamsWithGroups.forEach((team) => {
    const teamGroups = tableGroups.filter((g) => g.assignedTeamId === team.id);

    teamGroups.forEach((group) => {
      const assignments = group.staffAssignments || [];
      // Masa numaralarını veya loca adlarını çıkar
      const tableLabels = group.tableIds
        .map((id) => {
          const table = tables.find((t) => t.id === id);
          // Loca ise loca adını veya label'ı göster
          if (table?.isLoca) {
            return table.locaName || table.label || id;
          }
          // Normal masa - label varsa kullan
          if (table?.label) {
            return table.label;
          }
          const match = id.match(/-(\d+)$/);
          return match ? match[1] : id;
        })
        .sort((a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b, "tr");
        })
        .join(", ");

      if (assignments.length === 0) {
        data.push({
          Bölüm: "Takım",
          "Takım/Nokta": team.name,
          Grup: group.name,
          Masalar: tableLabels,
          Görev: "-",
          "Ad Soyad": "-",
          Unvan: "-",
          "Görev Yeri": "-",
          "Vardiya Başlangıç": "-",
          "Vardiya Bitiş": "-",
        });
      } else {
        assignments.forEach((a) => {
          const staff = allStaff.find((s) => s.id === a.staffId);
          const roleInfo = STAFF_ROLES.find((r) => r.value === a.role);
          // Önce assignment'taki staffName'i kontrol et (ekstra personel için), yoksa allStaff'tan bul
          const staffName = a.staffName || staff?.fullName || "Bilinmeyen";
          data.push({
            Bölüm: "Takım",
            "Takım/Nokta": team.name,
            Grup: group.name,
            Masalar: tableLabels,
            Görev: roleInfo?.label || a.role,
            "Ad Soyad": staffName,
            Unvan: staff?.position || "-",
            "Görev Yeri": staff?.workLocation || "-",
            "Vardiya Başlangıç": a.shiftStart,
            "Vardiya Bitiş": a.shiftEnd,
          });
        });
      }
    });
  });

  // Hizmet Noktaları
  servicePoints.forEach((sp) => {
    const assignments = sp.staffAssignments || [];
    const pointTypeInfo = SERVICE_POINT_TYPES.find(
      (t) => t.value === sp.pointType
    );

    if (assignments.length === 0) {
      data.push({
        Bölüm: "Hizmet Noktası",
        "Takım/Nokta": sp.name,
        Grup: pointTypeInfo?.label || sp.pointType,
        Masalar: "-",
        Görev: "-",
        "Ad Soyad": "-",
        Unvan: "-",
        "Görev Yeri": "-",
        "Vardiya Başlangıç": "-",
        "Vardiya Bitiş": "-",
      });
    } else {
      assignments.forEach((a) => {
        const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
        const roleInfo = SERVICE_POINT_ROLES.find((r) => r.value === a.role);
        data.push({
          Bölüm: "Hizmet Noktası",
          "Takım/Nokta": sp.name,
          Grup: pointTypeInfo?.label || sp.pointType,
          Masalar: "-",
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

  // Worksheet oluştur
  const ws = XLSX.utils.json_to_sheet(data);

  // Sütun genişlikleri
  ws["!cols"] = [
    { wch: 14 }, // Bölüm
    { wch: 15 }, // Takım/Nokta
    { wch: 15 }, // Grup
    { wch: 25 }, // Masalar
    { wch: 12 }, // Görev
    { wch: 25 }, // Ad Soyad
    { wch: 20 }, // Unvan
    { wch: 20 }, // Görev Yeri
    { wch: 12 }, // Vardiya Başlangıç
    { wch: 12 }, // Vardiya Bitiş
  ];

  // Workbook oluştur
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Personel Listesi");

  // XLSX olarak indir
  XLSX.writeFile(wb, `${eventName || "organizasyon"}_personel_listesi.xlsx`);
}

// PDF Export - Dikey (Portrait) A4
function exportToPDF(
  teams: TeamDefinition[],
  tableGroups: TableGroup[],
  allStaff: Staff[],
  tables: TableData[],
  servicePoints: ServicePoint[],
  eventName?: string,
  eventDate?: string
) {
  // Sadece gruba atanmış takımları filtrele
  const teamsWithGroups = teams.filter((team) =>
    tableGroups.some((g) => g.assignedTeamId === team.id)
  );

  let content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Personel Organizasyonu - ${eventName || "Etkinlik"}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 9px; 
      color: #333;
      margin: 0;
      padding: 0;
    }
    .header { 
      text-align: center; 
      margin-bottom: 15px;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
    }
    .header h1 { 
      margin: 0 0 4px 0; 
      font-size: 16px;
      color: #1a1a1a;
    }
    .header p { 
      margin: 0; 
      color: #666;
      font-size: 10px;
    }
    .section-title {
      background: #333;
      color: white;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: bold;
      margin: 15px 0 10px 0;
      border-radius: 3px;
    }
    .team-section { 
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    .team-header { 
      background: #f0f0f0; 
      padding: 6px 10px;
      border-radius: 3px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .team-color { 
      width: 10px; 
      height: 10px; 
      border-radius: 50%;
      flex-shrink: 0;
    }
    .service-point-color {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .team-name { 
      font-weight: bold; 
      font-size: 11px;
    }
    .team-stats {
      margin-left: auto;
      font-size: 8px;
      color: #666;
    }
    .point-type {
      background: #e0f7fa;
      color: #00838f;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8px;
    }
    th { 
      background: #e0e0e0; 
      padding: 5px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 8px;
      border: 1px solid #ccc;
    }
    td { 
      padding: 4px 6px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    tr:nth-child(even) { background: #fafafa; }
    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .role-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .shift-time {
      font-family: monospace;
      font-size: 8px;
    }
    .footer {
      margin-top: 15px;
      text-align: center;
      font-size: 8px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
    .no-staff {
      color: #999;
      font-style: italic;
      padding: 8px;
      text-align: center;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${eventName || "Etkinlik"} - Personel Organizasyonu</h1>
    <p>${
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
`;

  // Takımlar Bölümü
  if (teamsWithGroups.length > 0) {
    content += `<div class="section-title">📋 Takımlar</div>`;

    teamsWithGroups.forEach((team) => {
      const teamGroups = tableGroups.filter(
        (g) => g.assignedTeamId === team.id
      );
      const totalTables = teamGroups.reduce(
        (sum, g) => sum + g.tableIds.length,
        0
      );
      const allAssignments = teamGroups.flatMap(
        (g) => g.staffAssignments || []
      );

      content += `
  <div class="team-section">
    <div class="team-header">
      <div class="team-color" style="background: ${team.color}"></div>
      <span class="team-name">${team.name}</span>
      <span class="team-stats">${teamGroups.length} grup | ${totalTables} masa | ${allAssignments.length} personel</span>
    </div>
`;

      if (allAssignments.length === 0) {
        content += `<div class="no-staff">Henüz personel atanmamış</div>`;
      } else {
        content += `
    <table>
      <thead>
        <tr>
          <th style="width: 10%">Grup</th>
          <th style="width: 12%">Masalar</th>
          <th style="width: 10%">Görev</th>
          <th style="width: 18%">Ad Soyad</th>
          <th style="width: 14%">Unvan</th>
          <th style="width: 14%">Görev Yeri</th>
          <th style="width: 8%">Başlangıç</th>
          <th style="width: 8%">Bitiş</th>
        </tr>
      </thead>
      <tbody>
`;

        teamGroups.forEach((group) => {
          const assignments = group.staffAssignments || [];
          // Masa numaralarını veya loca adlarını çıkar
          const tableLabels = group.tableIds
            .map((id) => {
              const table = tables.find((t) => t.id === id);
              // Loca ise loca adını veya label'ı göster
              if (table?.isLoca) {
                return table.locaName || table.label || id;
              }
              // Normal masa - label varsa kullan
              if (table?.label) {
                return table.label;
              }
              const match = id.match(/-(\d+)$/);
              return match ? match[1] : id;
            })
            .sort((a, b) => {
              const numA = parseInt(a);
              const numB = parseInt(b);
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              return a.localeCompare(b, "tr");
            })
            .join(", ");

          assignments.forEach((a, idx) => {
            const staff = allStaff.find((s) => s.id === a.staffId);
            const roleInfo = STAFF_ROLES.find((r) => r.value === a.role);

            content += `
        <tr>
          <td>${idx === 0 ? group.name : ""}</td>
          <td style="font-family: monospace; font-size: 7px;">${
            idx === 0 ? tableLabels : ""
          }</td>
          <td>
            <span class="role-badge">
              <span class="role-dot" style="background: ${
                roleInfo?.color || "#666"
              }"></span>
              ${roleInfo?.label || a.role}
            </span>
          </td>
          <td>${a.staffName || staff?.fullName || "Bilinmeyen"}</td>
          <td>${staff?.position || "-"}</td>
          <td>${staff?.workLocation || "-"}</td>
          <td class="shift-time">${a.shiftStart}</td>
          <td class="shift-time">${a.shiftEnd}</td>
        </tr>
`;
          });
        });

        content += `
      </tbody>
    </table>
`;
      }

      content += `</div>`;
    });
  }

  // Hizmet Noktaları Bölümü
  if (servicePoints.length > 0) {
    content += `<div class="section-title">📍 Hizmet Noktaları</div>`;

    servicePoints.forEach((sp) => {
      const assignments = sp.staffAssignments || [];
      const pointTypeInfo = SERVICE_POINT_TYPES.find(
        (t) => t.value === sp.pointType
      );

      content += `
  <div class="team-section">
    <div class="team-header">
      <div class="service-point-color" style="background: ${sp.color}"></div>
      <span class="team-name">${sp.name}</span>
      <span class="point-type">${pointTypeInfo?.label || sp.pointType}</span>
      <span class="team-stats">${assignments.length}/${
        sp.requiredStaffCount
      } personel</span>
    </div>
`;

      if (assignments.length === 0) {
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

        assignments.forEach((a) => {
          const staff = a.staff || allStaff.find((s) => s.id === a.staffId);
          const roleInfo = SERVICE_POINT_ROLES.find((r) => r.value === a.role);

          content += `
        <tr>
          <td>
            <span class="role-badge">
              <span class="role-dot" style="background: ${
                roleInfo?.color || "#666"
              }"></span>
              ${roleInfo?.label || a.role}
            </span>
          </td>
          <td>${staff?.fullName || "Bilinmeyen"}</td>
          <td>${staff?.position || "-"}</td>
          <td>${staff?.workLocation || "-"}</td>
          <td class="shift-time">${a.shiftStart || "-"}</td>
          <td class="shift-time">${a.shiftEnd || "-"}</td>
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

  content += `
  <div class="footer">
    Oluşturulma Tarihi: ${new Date().toLocaleString("tr-TR")} | EventFlow PRO
  </div>
</body>
</html>
`;

  // Yeni pencerede aç ve yazdır
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
  eventId,
  eventName,
  eventDate,
  onExportPDF,
  onExportExcel,
}: Step5SummaryProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedServicePoints, setExpandedServicePoints] = useState<
    Set<string>
  >(new Set());

  // Şablon kaydetme state'leri
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleTeam = useCallback((teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }, []);

  const toggleServicePoint = useCallback((spId: string) => {
    setExpandedServicePoints((prev) => {
      const next = new Set(prev);
      if (next.has(spId)) {
        next.delete(spId);
      } else {
        next.add(spId);
      }
      return next;
    });
  }, []);

  // Export handlers
  const handleExportExcel = useCallback(async () => {
    await exportToExcel(
      teams,
      tableGroups,
      allStaff,
      tables,
      servicePoints,
      eventName
    );
    onExportExcel?.();
  }, [
    teams,
    tableGroups,
    allStaff,
    tables,
    servicePoints,
    eventName,
    onExportExcel,
  ]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(
      teams,
      tableGroups,
      allStaff,
      tables,
      servicePoints,
      eventName,
      eventDate
    );
    onExportPDF?.();
  }, [
    teams,
    tableGroups,
    allStaff,
    tables,
    servicePoints,
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

  // Şablon modal'ını aç
  const handleOpenSaveTemplateModal = useCallback(() => {
    setTemplateName(eventName ? `${eventName} Şablonu` : "Yeni Şablon");
    setTemplateDescription("");
    setSaveSuccess(false);
    setShowSaveTemplateModal(true);
  }, [eventName]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalTables = tableGroups.reduce(
      (sum, g) => sum + g.tableIds.length,
      0
    );
    const assignedGroups = tableGroups.filter((g) => g.assignedTeamId).length;
    const totalStaffAssigned = tableGroups.reduce(
      (sum, g) => sum + (g.staffAssignments?.length || 0),
      0
    );
    // Hizmet noktalarındaki personel sayısı
    const servicePointStaffCount = servicePoints.reduce(
      (sum, sp) => sum + (sp.staffAssignments?.length || 0),
      0
    );
    const groupsWithStaff = tableGroups.filter(
      (g) => g.staffAssignments && g.staffAssignments.length > 0
    ).length;
    const completionPercent =
      assignedGroups > 0
        ? Math.round((groupsWithStaff / assignedGroups) * 100)
        : tableGroups.length === 0
        ? 100
        : 0;

    // Sadece gruba atanmış takımları say
    const teamsWithGroups = teams.filter((team) =>
      tableGroups.some((g) => g.assignedTeamId === team.id)
    );

    return {
      totalGroups: tableGroups.length,
      totalTables,
      totalTeams: teamsWithGroups.length,
      assignedGroups,
      unassignedGroups: tableGroups.length - assignedGroups,
      totalStaffAssigned: totalStaffAssigned + servicePointStaffCount,
      groupsWithStaff,
      groupsWithoutStaff: assignedGroups - groupsWithStaff,
      completionPercent,
      servicePointsCount: servicePoints.length,
      servicePointStaffCount,
    };
  }, [tableGroups, teams, servicePoints]);

  // Generate warnings
  const warnings = useMemo(() => {
    const list: { type: "error" | "warning" | "info"; message: string }[] = [];

    const unassignedGroups = tableGroups.filter((g) => !g.assignedTeamId);
    if (unassignedGroups.length > 0) {
      list.push({
        type: "warning",
        message: `${
          unassignedGroups.length
        } grup takıma atanmamış: ${unassignedGroups
          .map((g) => g.name)
          .join(", ")}`,
      });
    }

    // Gruba atanmamış takımları uyarı olarak gösterme - sadece bilgi amaçlı
    const teamsWithoutGroups = teams.filter(
      (t) => !tableGroups.some((g) => g.assignedTeamId === t.id)
    );
    if (teamsWithoutGroups.length > 0) {
      list.push({
        type: "warning",
        message: `${
          teamsWithoutGroups.length
        } takıma grup atanmamış: ${teamsWithoutGroups
          .map((t) => t.name)
          .join(", ")}`,
      });
    }

    const groupsWithoutStaff = tableGroups.filter(
      (g) =>
        g.assignedTeamId &&
        (!g.staffAssignments || g.staffAssignments.length === 0)
    );
    if (groupsWithoutStaff.length > 0) {
      list.push({
        type: "error",
        message: `${
          groupsWithoutStaff.length
        } gruba personel atanmamış: ${groupsWithoutStaff
          .map((g) => g.name)
          .join(", ")}`,
      });
    }

    // Hizmet noktası uyarıları
    const servicePointsWithoutStaff = servicePoints.filter(
      (sp) => !sp.staffAssignments || sp.staffAssignments.length === 0
    );
    if (servicePointsWithoutStaff.length > 0) {
      list.push({
        type: "warning",
        message: `${
          servicePointsWithoutStaff.length
        } hizmet noktasına personel atanmamış: ${servicePointsWithoutStaff
          .map((sp) => sp.name)
          .join(", ")}`,
      });
    }

    if (list.length === 0) {
      list.push({
        type: "info",
        message: "Tüm atamalar tamamlandı!",
      });
    }

    return list;
  }, [tableGroups, teams, servicePoints]);

  // Groups by team - sadece gruba atanmış takımlar
  const teamsWithGroups = useMemo(() => {
    return teams.filter((team) =>
      tableGroups.some((g) => g.assignedTeamId === team.id)
    );
  }, [teams, tableGroups]);

  const groupsByTeam = useMemo(() => {
    const map = new Map<string, TableGroup[]>();
    teamsWithGroups.forEach((team) => {
      map.set(
        team.id,
        tableGroups.filter((g) => g.assignedTeamId === team.id)
      );
    });
    return map;
  }, [teamsWithGroups, tableGroups]);

  const hasErrors = warnings.some((w) => w.type === "error");
  const hasWarnings = warnings.some((w) => w.type === "warning");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Özet</h2>
          <p className="text-sm text-slate-400">
            Organizasyonu kontrol edin ve kaydedin
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Takım"
          value={stats.totalTeams}
          color="#8b5cf6"
        />
        <StatCard
          icon={Layers}
          label="Grup"
          value={stats.totalGroups}
          subValue={
            stats.unassignedGroups > 0
              ? `${stats.unassignedGroups} atanmamış`
              : undefined
          }
          color="#3b82f6"
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
          value={stats.totalStaffAssigned}
          subValue={`${stats.groupsWithStaff}/${stats.assignedGroups} gruba atandı`}
          color="#f59e0b"
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

      {/* Team Breakdown */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-2">
          Takım Detayları
        </h3>
        {teamsWithGroups.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Gruba atanmış takım bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teamsWithGroups.map((team) => (
              <TeamBreakdown
                key={team.id}
                team={team}
                groups={groupsByTeam.get(team.id) || []}
                allStaff={allStaff}
                tables={tables}
                isExpanded={expandedTeams.has(team.id)}
                onToggle={() => toggleTeam(team.id)}
              />
            ))}
          </div>
        )}

        {/* Service Points Breakdown */}
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
            {stats.completionPercent === 100 && !hasErrors && !hasWarnings ? (
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
              %{stats.completionPercent}
            </p>
            <p className="text-xs text-slate-500">Tamamlanma</p>
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

                {/* Özet Bilgi */}
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-slate-400">
                    Şablona dahil edilecek:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-purple-600/20 text-purple-400"
                    >
                      {teams.length} Takım
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-blue-600/20 text-blue-400"
                    >
                      {tableGroups.length} Grup
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-amber-600/20 text-amber-400"
                    >
                      {stats.totalStaffAssigned} Personel Ataması
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
