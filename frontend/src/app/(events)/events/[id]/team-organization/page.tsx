"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  UsersRound,
  ArrowLeft,
  Calendar,
  Clock,
  FolderOpen,
  Download,
  Save,
  Loader2,
  RotateCcw,
  List,
  ChevronRight,
  Home,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { eventsApi, staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/ui/PageContainer";
import * as XLSX from "xlsx";
import {
  EventAssignmentTab,
  EventAssignmentTabRef,
} from "@/components/team-organization";

interface Event {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  status: string;
  venueLayout?: any;
}

export default function TeamOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTeamListModal, setShowTeamListModal] = useState(false);
  const assignmentTabRef = useRef<EventAssignmentTabRef>(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await eventsApi.getOne(eventId);
        setEvent(response.data);
      } catch (error) {
        console.error("Etkinlik yüklenemedi:", error);
        router.push("/staff");
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadEvent();
    }
  }, [eventId, router]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg bg-slate-700" />
            <div>
              <Skeleton className="h-6 w-48 bg-slate-700 mb-2" />
              <Skeleton className="h-4 w-32 bg-slate-700" />
            </div>
          </div>
          <Skeleton className="h-[600px] w-full bg-slate-700" />
        </div>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">Etkinlik bulunamadı</p>
          <Button asChild>
            <Link href="/staff">Ekip Yönetimine Dön</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  // Etkinlikte alan planı var mı kontrol et (tables veya placedTables olabilir)
  const tables =
    event.venueLayout?.tables || event.venueLayout?.placedTables || [];
  const hasVenueLayout = tables.length > 0;

  if (!hasVenueLayout) {
    return (
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/staff")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">{event.name}</h1>
              <p className="text-sm text-slate-400">Ekip Organizasyonu</p>
            </div>
          </div>

          {/* Alan planı yok uyarısı */}
          <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
            <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Alan Planı Bulunamadı
            </h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Ekip organizasyonu yapabilmek için önce etkinliğin alan planını
              oluşturmanız gerekiyor.
            </p>
            <Button asChild className="bg-purple-600">
              <Link href={`/events/${eventId}/venue`}>Alan Planı Oluştur</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <TooltipProvider>
      <PageContainer>
        <div className="space-y-4">
          {/* Header - Venue sayfasıyla aynı stil */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-6">
              <h1 className="text-base font-semibold text-white">
                {event.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleDateString("tr-TR")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTeamListModal(true)}
                className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
              >
                <List className="w-4 h-4 mr-2" />
                Ekip Listesi
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  assignmentTabRef.current?.openLoadTemplateModal()
                }
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Şablondan Yükle
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  assignmentTabRef.current?.openSaveTemplateModal()
                }
                className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
              >
                <Download className="w-4 h-4 mr-2" />
                Şablon Kaydet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignmentTabRef.current?.reset()}
                disabled={!hasChanges || saving}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Sıfırla
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  setSaving(true);
                  await assignmentTabRef.current?.save();
                  setSaving(false);
                }}
                disabled={!hasChanges || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Kaydet
              </Button>
            </div>
          </div>

          {/* Canvas - Etkinlik Ekip Ataması */}
          <EventAssignmentTab
            ref={assignmentTabRef}
            eventId={eventId}
            onChangeStatus={setHasChanges}
          />
        </div>

        {/* Ekip Atamaları Modal */}
        <Dialog open={showTeamListModal} onOpenChange={setShowTeamListModal}>
          <DialogContent className="!max-w-[800px] bg-slate-800 border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white flex items-center gap-2">
                  <UsersRound className="w-5 h-5 text-amber-400" />
                  Görevlendirme Listesi
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const exportEvent = new CustomEvent("exportExcel");
                      document.dispatchEvent(exportEvent);
                    }}
                    className="border-green-600 text-green-400 hover:bg-green-600/20 h-8"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const exportEvent = new CustomEvent("exportPDF");
                      document.dispatchEvent(exportEvent);
                    }}
                    className="border-red-600 text-red-400 hover:bg-red-600/20 h-8"
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="overflow-y-auto flex-1">
              <TeamAssignmentList eventId={eventId} />
            </div>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </TooltipProvider>
  );
}

// Görevlendirme Listesi Bileşeni - Tablo Formatı
function TeamAssignmentList({ eventId }: { eventId: string }) {
  const [data, setData] = useState<{
    teams: any[];
    tableGroups: any[];
    staffAssignments: any[];
  }>({ teams: [], tableGroups: [], staffAssignments: [] });
  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");

  // Masa ID'sinden sadece numarayı çıkar
  const extractTableNumber = (tableId: string): string => {
    const matches = tableId.match(/(\d+)$/);
    return matches ? matches[1] : tableId;
  };

  // Masa numaralarını formatla (sadece numaralar, tire ile ayrılmış)
  const formatTableNumbers = (tableIds: string[]): string => {
    const numbers = tableIds
      .map(extractTableNumber)
      .map((n) => parseInt(n))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    return numbers.join("-") || "-";
  };

  // Vardiya saatini formatla (saniyesiz)
  const formatShiftTime = (shift: any): string => {
    if (!shift) return "-";
    if (shift.name) return shift.name;
    const start = shift.startTime?.substring(0, 5) || "";
    const end = shift.endTime?.substring(0, 5) || "";
    return start && end ? `${start}-${end}` : "-";
  };

  // Her personel ataması için bir satır oluştur
  const rows: Array<{
    teamId: string;
    teamName: string;
    teamColor: string;
    teamSortOrder: number;
    tableNumbers: string;
    staffName: string;
    shiftTime: string;
    shiftColor: string;
  }> = [];

  data.staffAssignments.forEach((assignment: any) => {
    const assignedTableIds = assignment.tableIds || [];
    if (assignedTableIds.length === 0) return;

    let team = assignment.team;

    if (!team) {
      const matchingGroup = data.tableGroups.find((group: any) =>
        group.tableIds?.some((tid: string) => assignedTableIds.includes(tid))
      );
      if (matchingGroup?.assignedTeamId) {
        team = data.teams.find(
          (t: any) => t.id === matchingGroup.assignedTeamId
        );
      }
    }

    rows.push({
      teamId: team?.id || "",
      teamName: team?.name || "-",
      teamColor: team?.color || "#3b82f6",
      teamSortOrder: team?.sortOrder ?? 999,
      tableNumbers: formatTableNumbers(assignedTableIds),
      staffName: assignment.staff?.fullName || "-",
      shiftTime: formatShiftTime(assignment.shift),
      shiftColor: assignment.shift?.color || "#6b7280",
    });
  });

  // Takım sırasına göre, sonra masa grubuna göre sırala
  rows.sort((a, b) => {
    const teamCompare = a.teamName.localeCompare(b.teamName, "tr", {
      numeric: true,
    });
    if (teamCompare !== 0) return teamCompare;

    const tableCompare = a.tableNumbers.localeCompare(b.tableNumbers, "tr", {
      numeric: true,
    });
    if (tableCompare !== 0) return tableCompare;

    return a.staffName.localeCompare(b.staffName, "tr");
  });

  // Excel Export Fonksiyonu
  const exportToExcel = () => {
    const exportData = rows.map((row) => ({
      Ekip: row.teamName,
      Masalar: row.tableNumbers,
      Personel: row.staffName,
      Vardiya: row.shiftTime,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Görevlendirme");

    ws["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];

    const fileName = `${eventName.replace(
      /[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g,
      ""
    )}_Gorevlendirme_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // PDF Export Fonksiyonu (HTML tabanlı yazdırma)
  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${eventName} - Görevlendirme Listesi</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #333; margin-bottom: 5px; }
          h2 { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e293b; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
          tr:nth-child(even) { background: #f8fafc; }
          .team-color { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
          .shift-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>${eventName}</h1>
        <h2>Görevlendirme Listesi - ${new Date().toLocaleDateString(
          "tr-TR"
        )}</h2>
        <table>
          <thead>
            <tr>
              <th>EKİP</th>
              <th>MASALAR</th>
              <th>PERSONEL</th>
              <th>VARDİYA</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                <td><span class="team-color" style="background:${
                  row.teamColor
                }"></span>${row.teamName}</td>
                <td style="font-family: monospace;">${row.tableNumbers}</td>
                <td>${row.staffName}</td>
                <td>${
                  row.shiftTime !== "-"
                    ? `<span class="shift-badge" style="background:${row.shiftColor}20;color:${row.shiftColor};border:1px solid ${row.shiftColor}40">${row.shiftTime}</span>`
                    : "-"
                }</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Data yükleme effect'i
  useEffect(() => {
    const loadData = async () => {
      try {
        const [teamsRes, groupsRes, assignmentsRes, eventRes] =
          await Promise.all([
            staffApi.getTeams(),
            staffApi.getEventTableGroups(eventId),
            staffApi.getEventStaffAssignments(eventId),
            eventsApi.getOne(eventId),
          ]);
        setData({
          teams: teamsRes.data || [],
          tableGroups: groupsRes.data || [],
          staffAssignments: assignmentsRes.data || [],
        });
        setEventName(eventRes.data?.name || "Etkinlik");
      } catch (error) {
        console.error("Liste verileri yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [eventId]);

  // Event listener'ları ekle - TÜM HOOKS'LARDAN SONRA
  useEffect(() => {
    const handleExcelExport = () => exportToExcel();
    const handlePDFExport = () => exportToPDF();

    document.addEventListener("exportExcel", handleExcelExport);
    document.addEventListener("exportPDF", handlePDFExport);

    return () => {
      document.removeEventListener("exportExcel", handleExcelExport);
      document.removeEventListener("exportPDF", handlePDFExport);
    };
  }, [rows, eventName]);

  // Loading durumu - TÜM HOOKS'LARDAN SONRA
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full bg-slate-700" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <UsersRound className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Henüz görevlendirme yapılmamış</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-slate-800">
        <tr className="border-b border-slate-600">
          <th className="text-left py-3 px-3 text-slate-400 font-semibold">
            EKİP
          </th>
          <th className="text-left py-3 px-3 text-slate-400 font-semibold">
            MASALAR
          </th>
          <th className="text-left py-3 px-3 text-slate-400 font-semibold">
            PERSONEL
          </th>
          <th className="text-left py-3 px-3 text-slate-400 font-semibold">
            VARDİYA
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          // Aynı masa grubundaki satırları grupla - önceki satırla aynı mı kontrol et
          const prevRow = index > 0 ? rows[index - 1] : null;
          const isNewGroup =
            !prevRow || prevRow.tableNumbers !== row.tableNumbers;

          // Grup indeksini hesapla (her yeni grup için artır)
          let groupIndex = 0;
          for (let i = 0; i <= index; i++) {
            if (i === 0 || rows[i].tableNumbers !== rows[i - 1].tableNumbers) {
              groupIndex++;
            }
          }

          // Alternatif arka plan rengi - takım rengini kullan (daha belirgin)
          const bgStyle =
            groupIndex % 2 === 0
              ? { backgroundColor: `${row.teamColor}18` } // Takım rengi %24 opacity
              : {}; // Şeffaf

          return (
            <tr
              key={index}
              className="border-b border-slate-700/30 hover:brightness-125 transition-all"
              style={bgStyle}
            >
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.teamColor }}
                  />
                  <span className="text-white font-medium text-xs">
                    {row.teamName}
                  </span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-slate-300 text-xs font-mono">
                {row.tableNumbers}
              </td>
              <td className="py-2.5 px-3 text-white text-xs">
                {row.staffName}
              </td>
              <td className="py-2.5 px-3">
                {row.shiftTime !== "-" ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${row.shiftColor}20`,
                      color: row.shiftColor,
                      border: `1px solid ${row.shiftColor}40`,
                    }}
                  >
                    {row.shiftTime}
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">-</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
