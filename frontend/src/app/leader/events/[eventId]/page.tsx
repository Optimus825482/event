"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Users,
  Calendar,
  MapPin,
  ArrowLeft,
  AlertCircle,
  Clock,
  Table2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { leaderApi, API_BASE } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/ui/toast-notification";

interface TableGroupInfo {
  id: string;
  name: string;
  color: string;
}
interface ShiftInfo {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface TeamMember {
  id: string;
  fullName: string;
  avatar?: string;
  color?: string;
  position?: string;
  tableIds: string[];
  assignmentType: string;
  specialTaskLocation?: string;
  shift?: ShiftInfo | null;
  specialTaskStartTime?: string;
  specialTaskEndTime?: string;
  tableGroups: TableGroupInfo[];
}

interface EventDetails {
  event: {
    id: string;
    name: string;
    date: string;
    startTime?: string;
    endTime?: string;
    venue?: string;
    status: string;
    guestCount?: number;
    venueLayout?: any;
  };
  team: { id: string; name: string; color: string } | null;
  members: TeamMember[];
  tableGroups: any[];
  totalGuests: number;
  venueLayout?: any;
}

export default function LeaderEventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { user } = useAuthStore();
  const eventId = params.eventId as string;

  const [data, setData] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"layout" | "list">("layout");
  const [tableGroupModal, setTableGroupModal] = useState<{
    open: boolean;
    group: TableGroupInfo | null;
    tableIds: string[];
  }>({ open: false, group: null, tableIds: [] });

  const loadEventDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaderApi.getEventDetails(eventId);
      setData(res.data);
    } catch (error: unknown) {
      console.error("Etkinlik detayları yüklenemedi:", error);
      toast.error("Etkinlik detayları yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (user?.role !== "leader") {
      router.push("/");
      return;
    }
    loadEventDetails();
  }, [user, loadEventDetails, router]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <Skeleton className="h-64 bg-slate-700 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-slate-400">Etkinlik bulunamadı</p>
          <Button onClick={() => router.push("/leader")} className="mt-4">
            Geri Dön
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { event, team, members, totalGuests, venueLayout } = data;
  const tables = venueLayout?.placedTables || venueLayout?.tables || [];
  const memberTableIds = members.flatMap((m) => m.tableIds || []);
  const memberColorMap = new Map<string, { color: string; name: string }>();
  members.forEach((m) => {
    m.tableIds?.forEach((tableId) => {
      memberColorMap.set(tableId, {
        color: m.color || "#3b82f6",
        name: m.fullName,
      });
    });
  });
  const selectedMemberTables = selectedMember
    ? members.find((m) => m.id === selectedMember)?.tableIds || []
    : [];

  let minX = Infinity,
    minY = Infinity,
    maxX = 0,
    maxY = 0;
  tables.forEach((t: any) => {
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.x + (t.width || 60) > maxX) maxX = t.x + (t.width || 60);
    if (t.y + (t.height || 60) > maxY) maxY = t.y + (t.height || 60);
  });
  if (venueLayout?.stage) {
    const s = venueLayout.stage;
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x + s.width > maxX) maxX = s.x + s.width;
    if (s.y + s.height > maxY) maxY = s.y + s.height;
  }
  const padding = 40;
  const canvasWidth = maxX - minX + padding * 2;
  const canvasHeight = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  const isEventCompleted = true; // Değerlendirme her zaman açık

  // Modal için masa grubu yerleşim hesaplamaları
  const modalTables = tables;
  let modalMinX = Infinity,
    modalMinY = Infinity,
    modalMaxX = 0,
    modalMaxY = 0;
  modalTables.forEach((t: any) => {
    if (t.x < modalMinX) modalMinX = t.x;
    if (t.y < modalMinY) modalMinY = t.y;
    if (t.x + (t.width || 60) > modalMaxX) modalMaxX = t.x + (t.width || 60);
    if (t.y + (t.height || 60) > modalMaxY) modalMaxY = t.y + (t.height || 60);
  });
  if (venueLayout?.stage) {
    const s = venueLayout.stage;
    if (s.x < modalMinX) modalMinX = s.x;
    if (s.y < modalMinY) modalMinY = s.y;
    if (s.x + s.width > modalMaxX) modalMaxX = s.x + s.width;
    if (s.y + s.height > modalMaxY) modalMaxY = s.y + s.height;
  }
  const modalPadding = 30;
  const modalCanvasWidth = modalMaxX - modalMinX + modalPadding * 2;
  const modalCanvasHeight = modalMaxY - modalMinY + modalPadding * 2;
  const modalOffsetX = -modalMinX + modalPadding;
  const modalOffsetY = -modalMinY + modalPadding;

  return (
    <PageContainer>
      {/* Masa Grubu Modal */}
      {tableGroupModal.open && tableGroupModal.group && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() =>
            setTableGroupModal({ open: false, group: null, tableIds: [] })
          }
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-[850px] max-w-[90vw] max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: tableGroupModal.group.color }}
                />
                {tableGroupModal.group.name
                  .replace(/\s*masalar?\s*/gi, "")
                  .trim()}
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-600 text-slate-300 ml-2"
                >
                  {tableGroupModal.tableIds.length} masa
                </Badge>
              </h3>
              <button
                onClick={() =>
                  setTableGroupModal({ open: false, group: null, tableIds: [] })
                }
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-400 mb-2 font-medium">
                Yerleşim Planı
              </p>
              <div
                className="bg-slate-900 rounded-lg overflow-auto relative"
                style={{ minHeight: "400px" }}
              >
                <div
                  className="p-4"
                  style={{
                    width: 900 * 0.55,
                    height: 680 * 0.55,
                    position: "relative",
                    transform: "scale(0.55)",
                    transformOrigin: "top left",
                  }}
                >
                  {/* Stage Elements */}
                  {venueLayout?.stageElements?.map((element: any) => (
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
                        className={`w-full h-full rounded-lg flex items-center justify-center opacity-40 ${
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

                  {/* Masalar */}
                  {modalTables
                    .filter((t: any) => !t.isLoca)
                    .map((table: any) => {
                      const isInGroup = tableGroupModal.tableIds.includes(
                        table.id
                      );
                      const groupColor = tableGroupModal.group!.color;

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
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg border-2 transition-all ${
                              isInGroup
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-125 z-10"
                                : "opacity-25"
                            }`}
                            style={{
                              backgroundColor: isInGroup
                                ? groupColor
                                : "#4b5563",
                              borderColor: isInGroup ? groupColor : "#6b7280",
                            }}
                          >
                            <span
                              className={`text-[9px] font-bold ${
                                isInGroup ? "text-white" : "text-slate-400"
                              }`}
                            >
                              {table.tableNumber || table.label || ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {/* Localar */}
                  {modalTables
                    .filter((t: any) => t.isLoca)
                    .map((loca: any) => {
                      const isInGroup = tableGroupModal.tableIds.includes(
                        loca.id
                      );
                      const groupColor = tableGroupModal.group!.color;

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
                              isInGroup
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 z-10"
                                : "opacity-25"
                            }`}
                            style={{
                              width: 56,
                              height: 32,
                              backgroundColor: isInGroup
                                ? groupColor
                                : "#4b5563",
                              borderColor: isInGroup ? groupColor : "#6b7280",
                            }}
                          >
                            <span
                              className={`text-[9px] font-bold ${
                                isInGroup ? "text-white" : "text-slate-400"
                              }`}
                            >
                              {loca.locaName || loca.tableNumber}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Legend */}
                <div className="absolute bottom-2 left-2 bg-slate-800/90 rounded-lg p-2 flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: tableGroupModal.group.color,
                      }}
                    />
                    <span className="text-slate-300">Seçili masalar</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-slate-600 opacity-25" />
                    <span className="text-slate-500">Diğer masalar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/leader")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <PageHeader
            title={event.name}
            description={new Date(event.date).toLocaleDateString("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            icon={<Calendar className="w-6 h-6 text-blue-400" />}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div
                className="text-2xl font-bold"
                style={{ color: team?.color || "#3b82f6" }}
              >
                {team?.name || "-"}
              </div>
              <div className="text-xs text-slate-400">Takım</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {members.length}
              </div>
              <div className="text-xs text-slate-400">Ekip Üyesi</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {memberTableIds.length}
              </div>
              <div className="text-xs text-slate-400">Atanan Masa</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">{totalGuests}</div>
              <div className="text-xs text-slate-400">Toplam Misafir</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 border-b border-slate-700 pb-2">
          <Button
            variant={activeTab === "layout" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("layout")}
            className={activeTab === "layout" ? "bg-blue-600" : ""}
          >
            <MapPin className="w-4 h-4 mr-1" />
            Yerleşim Planı
          </Button>
          <Button
            variant={activeTab === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("list")}
            className={activeTab === "list" ? "bg-blue-600" : ""}
          >
            <Table2 className="w-4 h-4 mr-1" />
            Ekip Listesi
          </Button>
        </div>

        {activeTab === "layout" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-green-400" />
                  Yerleşim Planı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="bg-slate-900 rounded-lg overflow-auto relative"
                  style={{ height: "400px" }}
                >
                  <div className="absolute inset-0 overflow-auto p-4">
                    <div
                      style={{
                        width: 850,
                        height: 500,
                        position: "relative",
                        transform: "scale(0.6)",
                        transformOrigin: "top left",
                      }}
                    >
                      {/* Stage Elements */}
                      {venueLayout?.stageElements?.map((element: any) => (
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
                            className={`w-full h-full rounded-lg flex items-center justify-center opacity-40 ${
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

                      {/* Masalar */}
                      {tables
                        .filter((t: any) => !t.isLoca)
                        .map((table: any) => {
                          const isAssigned = memberTableIds.includes(table.id);
                          const memberInfo = memberColorMap.get(table.id);
                          const staffColor = isAssigned
                            ? memberInfo?.color || "#3b82f6"
                            : "#4b5563";
                          const isSelected = selectedMemberTables.includes(
                            table.id
                          );

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
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg border-2 transition-all ${
                                  isSelected
                                    ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-150 z-20"
                                    : isAssigned
                                    ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-125 z-10"
                                    : "opacity-25"
                                }`}
                                style={{
                                  backgroundColor: staffColor,
                                  borderColor: isAssigned
                                    ? staffColor
                                    : "#6b7280",
                                }}
                                title={
                                  isAssigned
                                    ? `${
                                        table.tableNumber || table.label || ""
                                      } - ${memberInfo?.name}`
                                    : table.tableNumber || table.label || ""
                                }
                              >
                                <span
                                  className={`text-[9px] font-bold ${
                                    isAssigned ? "text-white" : "text-slate-400"
                                  }`}
                                >
                                  {table.tableNumber || table.label || ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      {/* Localar */}
                      {tables
                        .filter((t: any) => t.isLoca)
                        .map((loca: any) => {
                          const isAssigned = memberTableIds.includes(loca.id);
                          const memberInfo = memberColorMap.get(loca.id);
                          const staffColor = isAssigned
                            ? memberInfo?.color || "#3b82f6"
                            : "#4b5563";
                          const isSelected = selectedMemberTables.includes(
                            loca.id
                          );

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
                                  isSelected
                                    ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-125 z-20"
                                    : isAssigned
                                    ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 z-10"
                                    : "opacity-25"
                                }`}
                                style={{
                                  width: 56,
                                  height: 32,
                                  backgroundColor: staffColor,
                                  borderColor: isAssigned
                                    ? staffColor
                                    : "#6b7280",
                                }}
                                title={
                                  isAssigned
                                    ? `${loca.locaName || loca.tableNumber} - ${
                                        memberInfo?.name
                                      }`
                                    : loca.locaName || loca.tableNumber
                                }
                              >
                                <span
                                  className={`text-[9px] font-bold ${
                                    isAssigned ? "text-white" : "text-slate-400"
                                  }`}
                                >
                                  {loca.locaName || loca.tableNumber}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="absolute bottom-2 left-2 bg-slate-800/90 rounded-lg p-2 flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full border-2 border-white bg-blue-500" />
                      <span className="text-slate-300">Atanan masalar</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-slate-600 opacity-25" />
                      <span className="text-slate-500">Diğer masalar</span>
                    </div>
                    {selectedMember && (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full border-2 border-yellow-400 bg-yellow-500" />
                        <span className="text-yellow-400">Seçili personel</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Ekip Üyeleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">
                    Ekip üyesi bulunamadı
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedMember === member.id
                            ? "bg-slate-600/50 ring-2 ring-yellow-400"
                            : "bg-slate-700/50 hover:bg-slate-700"
                        }`}
                        onClick={() =>
                          setSelectedMember(
                            selectedMember === member.id ? null : member.id
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            {member.avatar && (
                              <AvatarImage
                                src={`${API_BASE}${member.avatar}`}
                              />
                            )}
                            <AvatarFallback
                              style={{
                                backgroundColor: member.color || "#3b82f6",
                              }}
                            >
                              {member.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">
                              {member.fullName}
                            </p>
                            <p className="text-xs text-slate-400 capitalize">
                              {member.position || "Personel"}
                            </p>
                          </div>
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: member.color || "#3b82f6",
                            }}
                          />
                        </div>
                        {member.tableIds && member.tableIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {member.tableIds.slice(0, 5).map((tableId) => {
                              const table = tables.find(
                                (t: any) => t.id === tableId
                              );
                              return (
                                <Badge
                                  key={tableId}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {table?.label ||
                                    table?.tableNumber ||
                                    tableId.slice(0, 8)}
                                </Badge>
                              );
                            })}
                            {member.tableIds.length > 5 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{member.tableIds.length - 5}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "list" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Table2 className="w-5 h-5 text-cyan-400" />
                Ekip Üyeleri Listesi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  Ekip üyesi bulunamadı
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                          Personel
                        </th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                          Pozisyon
                        </th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                          Masa Grupları
                        </th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                          Vardiya Saati
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr
                          key={member.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/30"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                {member.avatar && (
                                  <AvatarImage
                                    src={`${API_BASE}${member.avatar}`}
                                  />
                                )}
                                <AvatarFallback
                                  style={{
                                    backgroundColor: member.color || "#3b82f6",
                                  }}
                                  className="text-xs"
                                >
                                  {member.fullName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-white font-medium">
                                {member.fullName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-300 capitalize">
                              {member.position || "Personel"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2">
                              {member.tableGroups.length > 0 ? (
                                member.tableGroups.map((group) => {
                                  // Bu gruba ait masa ID'lerini bul
                                  const groupTableIds =
                                    data?.tableGroups.find(
                                      (g: any) => g.id === group.id
                                    )?.tableIds || [];
                                  return (
                                    <button
                                      key={group.id}
                                      onClick={() =>
                                        setTableGroupModal({
                                          open: true,
                                          group,
                                          tableIds: groupTableIds,
                                        })
                                      }
                                      className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{
                                        backgroundColor: group.color + "25",
                                        color: group.color,
                                        borderColor: group.color,
                                      }}
                                    >
                                      {group.name
                                        .replace(/\s*masalar?\s*/gi, "")
                                        .trim()}
                                    </button>
                                  );
                                })
                              ) : (
                                <span className="text-slate-500 text-sm">
                                  -
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {member.shift ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                <Clock className="w-4 h-4" />
                                {member.shift.startTime?.slice(0, 5)} -{" "}
                                {member.shift.endTime?.slice(0, 5)}
                              </span>
                            ) : member.specialTaskStartTime ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Clock className="w-4 h-4" />
                                {member.specialTaskStartTime} -{" "}
                                {member.specialTaskEndTime}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
