"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Eye,
  UserPlus,
  Shield,
  UsersRound,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  Settings,
  X,
  Upload,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { staffApi, eventsApi, API_BASE } from "@/lib/api";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";

// Görev tanımları - Varsayılan roller
type StaffPosition = string;

interface Role {
  id?: string;
  key: string;
  label: string;
  color: string;
  badgeColor: string;
  bgColor: string;
}

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  color?: string;
  position?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  assignedTables?: string[];
}

interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  members?: Staff[];
  leaderId?: string;
  leader?: Staff;
  sortOrder: number;
  isActive: boolean;
  assignedGroupCount?: number;
  assignedTableCount?: number;
}

interface Event {
  id: string;
  name: string;
  date?: string;
  eventDate?: string;
  time?: string;
  status: "planning" | "ready" | "completed" | "cancelled";
  venue?: { name: string };
  hasTeamAssignment?: boolean;
  hasVenueLayout?: boolean;
  venueLayout?: { placedTables?: any[] };
}

interface WorkShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const EVENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: {
    label: "Planlama",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  ready: {
    label: "Hazır",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  completed: {
    label: "Tamamlandı",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  cancelled: {
    label: "İptal",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Dinamik roller state'i
  const [roles, setRoles] = useState<Role[]>([]);

  // Giriş ekranı durumu
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Modal durumları
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Staff | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState<Team | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showBulkUploadInfo, setShowBulkUploadInfo] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Personel Konum Görüntüleme Modal State
  const [showStaffLocationModal, setShowStaffLocationModal] = useState(false);

  // Geri sayım state'i - her etkinlik için
  const [countdowns, setCountdowns] = useState<
    Record<
      string,
      { days: number; hours: number; minutes: number; seconds: number }
    >
  >({});
  const [selectedMemberForLocation, setSelectedMemberForLocation] =
    useState<Staff | null>(null);
  const [memberEventAssignments, setMemberEventAssignments] = useState<any[]>(
    []
  );
  const [selectedEventForLocation, setSelectedEventForLocation] =
    useState<any>(null);
  const [eventVenueLayout, setEventVenueLayout] = useState<any>(null);
  const [loadingEventLayout, setLoadingEventLayout] = useState(false);

  // Rolleri API'den yükle
  const loadRoles = async () => {
    try {
      const response = await staffApi.getRoles();
      setRoles(response.data || []);
    } catch (error: any) {
      console.error("Roller yüklenemedi:", error?.response?.data || error);
      setRoles([]);
    }
  };

  // Personel listesini yükle
  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await staffApi.getAll();
      setStaff(response.data || []);
    } catch (error) {
      console.error("Personel listesi yüklenemedi:", error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  // Etkinlikleri yükle
  const loadEvents = async () => {
    try {
      setEventsLoading(true);
      const response = await eventsApi.getAll();
      // En yeniden eskiye sırala
      const sorted = (response.data || []).sort((a: Event, b: Event) => {
        const dateA = a.eventDate || a.date;
        const dateB = b.eventDate || b.date;
        return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
      });
      setEvents(sorted);
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Çalışma saatlerini yükle
  const loadShifts = async () => {
    try {
      const response = await staffApi.getShifts();
      setShifts(response.data || []);
    } catch (error: any) {
      console.error(
        "Çalışma saatleri yüklenemedi:",
        error?.response?.data || error
      );
      setShifts([]);
    }
  };

  // Ekipleri yükle
  const loadTeams = async () => {
    try {
      const response = await staffApi.getTeams();
      setTeams(response.data || []);
    } catch (error: any) {
      console.error("Ekipler yüklenemedi:", error?.response?.data || error);
      setTeams([]);
    }
  };

  useEffect(() => {
    loadRoles();
    loadStaff();
    loadEvents();
    loadShifts();
    loadTeams();
  }, []);

  // Geri sayım timer - hazır etkinlikler için
  useEffect(() => {
    const updateCountdowns = () => {
      const now = new Date().getTime();
      const newCountdowns: Record<
        string,
        { days: number; hours: number; minutes: number; seconds: number }
      > = {};

      events.forEach((event) => {
        // Sadece hazır etkinlikler için (yerleşim ve ekip ataması tamamlanmış)
        const hasVenue =
          event.hasVenueLayout ||
          (event.venueLayout?.placedTables?.length ?? 0) > 0;
        const hasTeam = event.hasTeamAssignment;

        if (hasVenue && hasTeam) {
          const dateStr = event.eventDate || event.date;
          if (dateStr) {
            const eventTime = new Date(dateStr).getTime();
            const diff = eventTime - now;

            if (diff > 0) {
              newCountdowns[event.id] = {
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor(
                  (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                ),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
              };
            }
          }
        }
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [events]);

  // Personel konum modalını aç - personelin atandığı etkinlikleri yükle
  const openStaffLocationModal = async (member: Staff) => {
    setSelectedMemberForLocation(member);
    setShowStaffLocationModal(true);
    setMemberEventAssignments([]);
    setSelectedEventForLocation(null);
    setEventVenueLayout(null);

    try {
      // Personelin atandığı tüm etkinlikleri getir (event relation dahil)
      const response = await staffApi.getStaffEventAssignments(member.id);
      const assignments = response.data || [];
      setMemberEventAssignments(assignments);
    } catch (error) {
      console.error("Personel atamaları yüklenemedi:", error);
      setMemberEventAssignments([]);
    }
  };

  // Etkinlik seçildiğinde yerleşim planını yükle
  const handleSelectEventForLocation = async (assignment: any) => {
    setSelectedEventForLocation(assignment);
    setLoadingEventLayout(true);

    try {
      const eventRes = await eventsApi.getOne(assignment.eventId);
      setEventVenueLayout(eventRes.data?.venueLayout || null);
    } catch (error) {
      console.error("Etkinlik yerleşim planı yüklenemedi:", error);
      setEventVenueLayout(null);
    } finally {
      setLoadingEventLayout(false);
    }
  };

  // Pozisyona göre grupla - dinamik roller kullanarak
  const groupedByPosition = roles.reduce((acc, role) => {
    acc[role.key] = staff.filter((s) => s.position === role.key);
    return acc;
  }, {} as Record<string, Staff[]>);

  // Helper: Rol bilgisini key'e göre bul
  const getRoleByKey = (key: string) => roles.find((r) => r.key === key);
  const getRoleLabel = (key: string) => getRoleByKey(key)?.label || key;
  const getRoleColor = (key: string) => getRoleByKey(key)?.color || "#3b82f6";
  const getRoleBadgeColor = (key: string) =>
    getRoleByKey(key)?.badgeColor ||
    "bg-slate-500/20 text-slate-400 border-slate-500/30";

  const handleDeleteStaff = async () => {
    if (!deleteConfirm) return;
    try {
      await staffApi.delete(deleteConfirm.id);
      setStaff((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamConfirm) return;
    try {
      await staffApi.deleteNewTeam(deleteTeamConfirm.id);
      setTeams((prev) => prev.filter((t) => t.id !== deleteTeamConfirm.id));
      setDeleteTeamConfirm(null);
    } catch (error) {
      console.error("Ekip silme hatası:", error);
    }
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/events/${eventId}/team-organization`);
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Giriş Ekranı Header */}
        {!activeModule && (
          <div className="flex flex-col items-center justify-center py-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-400" />
              Ekip Yönetimi
            </h1>
            <p className="text-slate-400 mt-1">
              Personel, ekip ve etkinlik organizasyonu
            </p>
          </div>
        )}

        {/* Modül Header - Personel İşlemleri */}
        {activeModule === "personnel" && (
          <>
            {/* Geri Butonu ve Breadcrumb */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveModule(null)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                <ArrowLeft className="w-10 h-10" strokeWidth={1.5} />
              </button>
              <nav className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setActiveModule(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Ekip Yönetimi
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-white font-medium">
                  Personel Yönetimi
                </span>
              </nav>
            </div>

            {/* Başlık Card - Ortalanmış */}
            <div className="flex justify-center">
              <Card className="bg-slate-800/50 border-slate-700 w-full max-w-md">
                <CardContent className="py-1">
                  <h1 className="font-semibold text-white text-center">
                    PERSONEL YÖNETİMİ
                  </h1>
                </CardContent>
              </Card>
            </div>

            {/* Butonlar ve Bilgi Satırı */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Yeni Personel
                </Button>
                <Button
                  onClick={() => setShowBulkUploadInfo(true)}
                  size="sm"
                  variant="outline"
                  className="border-green-600 text-green-400 hover:bg-green-600/20"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Toplu Yükle
                </Button>
                <Button
                  onClick={() => setShowRolesModal(true)}
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Personel Rolleri
                </Button>
              </div>
              <p className="text-slate-400 text-sm">
                Toplam {staff.length} personel kayıtlı
              </p>
            </div>
          </>
        )}

        {/* Modül Header - Ekip Organizasyonu */}
        {activeModule === "teams" && (
          <>
            {/* Geri Butonu ve Breadcrumb */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveModule(null)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                <ArrowLeft className="w-10 h-10" strokeWidth={1.5} />
              </button>
              <nav className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setActiveModule(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Ekip Yönetimi
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-white font-medium">
                  Ekip Organizasyonu
                </span>
              </nav>
            </div>

            {/* Başlık Card - Ortalanmış */}
            <div className="flex justify-center">
              <Card className="bg-slate-800/50 border-slate-700 w-full max-w-md">
                <CardContent className="py-1">
                  <h1 className="font-semibold text-white text-center">
                    EKİP ORGANİZASYONU
                  </h1>
                </CardContent>
              </Card>
            </div>

            {/* Butonlar ve Bilgi Satırı */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowTeamModal(true)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Ekip
                </Button>
                <Button
                  onClick={() => setShowShiftsModal(true)}
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Çalışma Saatleri
                </Button>
              </div>
              <p className="text-slate-400 text-sm">
                Toplam {teams.length} ekip
              </p>
            </div>
          </>
        )}

        {/* Modül Header - Etkinlik Ekip Organizasyonu */}
        {activeModule === "event-assignment" && (
          <>
            {/* Geri Butonu ve Breadcrumb */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveModule(null)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                <ArrowLeft className="w-10 h-10" strokeWidth={1.5} />
              </button>
              <nav className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setActiveModule(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Ekip Yönetimi
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-white font-medium">
                  Etkinlik Ekip Organizasyonu
                </span>
              </nav>
            </div>

            {/* Başlık Card - Ortalanmış */}
            <div className="flex justify-center">
              <Card className="bg-slate-800/50 border-slate-700 w-full max-w-md">
                <CardContent className="py-1">
                  <h1 className="font-semibold text-white text-center">
                    ETKİNLİK EKİP ORGANİZASYONU
                  </h1>
                </CardContent>
              </Card>
            </div>

            {/* Bilgi Satırı */}
            <div className="flex items-center justify-end">
              <p className="text-slate-400 text-sm">{events.length} etkinlik</p>
            </div>
          </>
        )}

        {/* Giriş Ekranı - 3 Blok */}
        {!activeModule && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Personel İşlemleri */}
            <Card
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
              onClick={() => setActiveModule("personnel")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <Users className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Personel İşlemleri
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Etkinliklerde görev alacak personellerin listesi ve kayıt
                      işlemleri
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-purple-500/10 border-purple-500/30 text-purple-400"
                  >
                    {staff.length} Personel
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 2. Ekip Organizasyonu */}
            <Card
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group"
              onClick={() => setActiveModule("teams")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <UsersRound className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Ekip Organizasyonu
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Etkinliklerde görevlendirilecek ekiplerin oluşturulması,
                      düzenlenmesi ve listesi
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 border-blue-500/30 text-blue-400"
                  >
                    {teams.length} Ekip
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 3. Etkinlik Ekip Organizasyonu */}
            <Card
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
              onClick={() => setActiveModule("event-assignment")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <Calendar className="w-8 h-8 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Etkinlik Ekip Organizasyonu
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Etkinlik yerleşim planı üzerinde oluşturulmuş ekiplerin
                      planlaması
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 border-amber-500/30 text-amber-400"
                  >
                    {events.length} Etkinlik
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modül İçerikleri */}
        {activeModule && (
          <Tabs value={activeModule} className="w-full">
            {/* TAB 1: Personel İşlemleri */}
            <TabsContent value="personnel" className="mt-0 space-y-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64 w-full bg-slate-700" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map((role) => {
                    const positionStaff = groupedByPosition[role.key] || [];

                    return (
                      <Card
                        key={role.key}
                        className="bg-slate-800 border-slate-700 overflow-hidden flex flex-col"
                      >
                        {/* Card Header - Rol Başlığı */}
                        <div
                          className="h-1.5"
                          style={{ backgroundColor: role.color }}
                        />
                        <div className="p-3 border-b border-slate-700 bg-slate-800/80">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="font-semibold text-white text-sm">
                                {role.label}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${role.badgeColor}`}
                            >
                              {positionStaff.length}
                            </Badge>
                          </div>
                        </div>

                        {/* Card Content - Personel Listesi */}
                        <CardContent className="p-0 flex-1 overflow-y-auto max-h-[320px]">
                          {positionStaff.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              Kayıtlı personel yok
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-700/50">
                              {positionStaff.map((person) => (
                                <div
                                  key={person.id}
                                  className="p-2.5 hover:bg-slate-700/30 transition-colors group"
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar
                                      className="w-8 h-8 border-2 flex-shrink-0"
                                      style={{
                                        borderColor: person.color || "#3b82f6",
                                      }}
                                    >
                                      <AvatarImage
                                        src={getAvatarUrl(person.avatar)}
                                        alt={person.fullName}
                                      />
                                      <AvatarFallback
                                        style={{
                                          backgroundColor:
                                            person.color || "#3b82f6",
                                        }}
                                        className="text-white font-bold text-xs"
                                      >
                                        {person.fullName
                                          .charAt(0)
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">
                                        {person.fullName}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate">
                                        {person.phone || person.email}
                                      </p>
                                    </div>
                                    {/* Hover'da görünen işlem butonları */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-white"
                                        onClick={() => setViewingStaff(person)}
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-white"
                                        onClick={() => setEditingStaff(person)}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-400 hover:text-red-300"
                                        onClick={() => setDeleteConfirm(person)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Ekip Organizasyonu */}
            <TabsContent value="teams" className="mt-0">
              <div className="flex gap-4 h-[calc(100vh-220px)]">
                {/* Sol Panel - Ekip Listesi */}
                <div className="w-72 flex-shrink-0 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
                  {/* Panel Başlık */}
                  <div className="p-3 border-b border-slate-700 bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UsersRound className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-white text-sm">
                          Ekipler
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-xs"
                      >
                        {teams.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Ekip Listesi */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {teams.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        Henüz ekip yok
                      </div>
                    ) : (
                      teams.map((team) => {
                        const leader = staff.find(
                          (s) => s.id === team.leaderId
                        );
                        const memberCount =
                          team.members?.length || team.memberIds?.length || 0;

                        return (
                          <div
                            key={team.id}
                            className={`p-3 rounded-lg transition-colors group cursor-pointer ${
                              selectedTeam?.id === team.id
                                ? "bg-slate-600 ring-2 ring-blue-500"
                                : "bg-slate-700/50 hover:bg-slate-700"
                            }`}
                            onClick={() => setSelectedTeam(team)}
                          >
                            {/* Ekip Başlık */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: team.color }}
                                />
                                <span className="font-medium text-white text-sm truncate max-w-[120px]">
                                  {team.name}
                                </span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-white"
                                  onClick={() => setEditingTeam(team)}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-400 hover:text-red-300"
                                  onClick={() => setDeleteTeamConfirm(team)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Lider Bilgisi */}
                            {leader ? (
                              <div className="flex items-center gap-2 mb-2">
                                <Avatar
                                  className="w-6 h-6 border"
                                  style={{ borderColor: leader.color }}
                                >
                                  <AvatarImage
                                    src={getAvatarUrl(leader.avatar)}
                                  />
                                  <AvatarFallback
                                    style={{ backgroundColor: leader.color }}
                                    className="text-white text-xs"
                                  >
                                    {leader.fullName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white truncate">
                                    {leader.fullName}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Lider
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 mb-2 italic">
                                Lider atanmamış
                              </div>
                            )}

                            {/* Üye Sayısı */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">
                                {memberCount} üye
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4"
                                style={{
                                  backgroundColor: `${team.color}20`,
                                  borderColor: `${team.color}50`,
                                  color: team.color,
                                }}
                              >
                                Aktif
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Yeni Ekip Butonu */}
                  <div className="p-2 border-t border-slate-700">
                    <Button
                      onClick={() => setShowTeamModal(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-9"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Yeni Ekip
                    </Button>
                  </div>
                </div>

                {/* Sağ Panel - Ekip Detayları */}
                <div className="flex-1 bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
                  {!selectedTeam ? (
                    <div className="flex-1 flex items-center justify-center">
                      {teams.length === 0 ? (
                        <div className="text-center">
                          <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                          <p className="text-slate-400 mb-2">
                            Henüz ekip oluşturulmamış
                          </p>
                          <p className="text-slate-500 text-sm mb-4">
                            Sol panelden yeni ekip oluşturabilirsiniz
                          </p>
                          <Button
                            onClick={() => setShowTeamModal(true)}
                            className="bg-purple-600"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            İlk Ekibi Oluştur
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <UsersRound className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                          <p className="text-slate-400 text-sm">
                            {teams.length} ekip tanımlı
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            Detayları görmek için bir ekip seçin
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Ekip Başlık */}
                      <div
                        className="p-4 border-b border-slate-700"
                        style={{ backgroundColor: `${selectedTeam.color}15` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: selectedTeam.color }}
                            />
                            <h2 className="text-lg font-semibold text-white">
                              {selectedTeam.name}
                            </h2>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                backgroundColor: `${selectedTeam.color}20`,
                                borderColor: `${selectedTeam.color}50`,
                                color: selectedTeam.color,
                              }}
                            >
                              {selectedTeam.members?.length || 0} Üye
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-slate-700/50 border-slate-600 text-slate-300 text-xs"
                            >
                              {selectedTeam.assignedGroupCount || 0} Grup
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-slate-700/50 border-slate-600 text-slate-300 text-xs"
                            >
                              {selectedTeam.assignedTableCount || 0} Masa
                            </Badge>
                          </div>
                        </div>
                        {/* Lider Bilgisi */}
                        {selectedTeam.leader && (
                          <div className="flex items-center gap-2 mt-3">
                            <Avatar
                              className="w-8 h-8 border-2"
                              style={{ borderColor: selectedTeam.leader.color }}
                            >
                              <AvatarImage
                                src={getAvatarUrl(selectedTeam.leader.avatar)}
                              />
                              <AvatarFallback
                                style={{
                                  backgroundColor: selectedTeam.leader.color,
                                }}
                                className="text-white text-sm"
                              >
                                {selectedTeam.leader.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm text-white">
                                {selectedTeam.leader.fullName}
                              </p>
                              <p className="text-xs text-slate-400">
                                Ekip Lideri
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Üye Listesi */}
                      <div className="flex-1 overflow-y-auto p-4">
                        {selectedTeam.members &&
                        selectedTeam.members.length > 0 ? (
                          <>
                            {/* Diğer Üyeler */}
                            {(() => {
                              const otherMembers =
                                selectedTeam.members?.filter(
                                  (m) => m.id !== selectedTeam.leaderId
                                ) || [];
                              if (otherMembers.length === 0) return null;
                              return (
                                <div>
                                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Ekip Üyeleri ({otherMembers.length})
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {otherMembers.map((member) => {
                                      const role = getRoleByKey(
                                        member.position || ""
                                      );
                                      const tableCount =
                                        member.assignedTables?.length || 0;
                                      const tableNumbers = (
                                        member.assignedTables || []
                                      )
                                        .map((t) => {
                                          // "table-new-xxx" formatı için "Y" göster
                                          if (t.startsWith("table-new-"))
                                            return "Y";
                                          // "loca-X" formatı için "LX" göster
                                          if (t.startsWith("loca-")) {
                                            const num = t.replace("loca-", "");
                                            return `L${parseInt(num) + 1}`;
                                          }
                                          // Diğerleri için sondaki sayıyı al
                                          const match = t.match(/-(\d+)$/);
                                          return match ? match[1] : t.slice(-3);
                                        })
                                        .slice(0, 6);

                                      return (
                                        <div
                                          key={member.id}
                                          onClick={() =>
                                            openStaffLocationModal(member)
                                          }
                                          className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 hover:bg-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                                        >
                                          <div className="flex items-start gap-3">
                                            <Avatar
                                              className="w-10 h-10 border-2 flex-shrink-0"
                                              style={{
                                                borderColor:
                                                  member.color || "#3b82f6",
                                              }}
                                            >
                                              <AvatarImage
                                                src={getAvatarUrl(
                                                  member.avatar
                                                )}
                                              />
                                              <AvatarFallback
                                                style={{
                                                  backgroundColor:
                                                    member.color || "#3b82f6",
                                                }}
                                                className="text-white font-bold"
                                              >
                                                {member.fullName.charAt(0)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-white truncate">
                                                {member.fullName}
                                              </p>
                                              <p className="text-xs text-slate-400">
                                                {role?.label ||
                                                  member.position ||
                                                  "Personel"}
                                              </p>
                                              {tableCount > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                  {tableNumbers.map(
                                                    (num, idx) => (
                                                      <span
                                                        key={idx}
                                                        className="px-1.5 py-0.5 text-[10px] rounded bg-slate-600 text-slate-300"
                                                      >
                                                        {num}
                                                      </span>
                                                    )
                                                  )}
                                                  {tableCount > 6 && (
                                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-600 text-slate-400">
                                                      +{tableCount - 6}
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <div className="text-center py-8 text-slate-500">
                            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Bu ekipte henüz üye yok</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Etkinlik Ekip Organizasyonu */}
            <TabsContent value="event-assignment" className="mt-0 space-y-4">
              {eventsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full bg-slate-700" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-12 text-center">
                    <Calendar className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400 mb-4">
                      Henüz etkinlik oluşturulmamış
                    </p>
                    <Button
                      onClick={() => router.push("/events/new")}
                      className="bg-purple-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Etkinlik Oluştur
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => {
                    const dateStr = event.eventDate || event.date;
                    const eventDate = dateStr ? new Date(dateStr) : null;
                    const isValidDate =
                      eventDate && !isNaN(eventDate.getTime());
                    const hasVenue =
                      event.hasVenueLayout ||
                      (event.venueLayout?.placedTables?.length ?? 0) > 0;
                    const hasTeam = event.hasTeamAssignment;
                    const isReady = hasVenue && hasTeam;
                    const countdown = countdowns[event.id];
                    const isFuture =
                      isValidDate && eventDate.getTime() > Date.now();

                    return (
                      <Card
                        key={event.id}
                        onClick={() => handleEventClick(event.id)}
                        className={`border hover:bg-slate-800 transition-all cursor-pointer group ${
                          isReady && isFuture
                            ? "bg-gradient-to-r from-slate-800/80 via-emerald-900/20 to-slate-800/80 border-emerald-500/30 hover:border-emerald-400/50"
                            : "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            {/* Tarih Bloğu */}
                            <div
                              className={`flex-shrink-0 w-20 h-20 rounded-xl border flex flex-col items-center justify-center ${
                                isReady && isFuture
                                  ? "bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border-emerald-500/30"
                                  : "bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30"
                              }`}
                            >
                              <span className="text-2xl font-bold text-white">
                                {isValidDate ? eventDate.getDate() : "-"}
                              </span>
                              <span
                                className={`text-xs uppercase ${
                                  isReady && isFuture
                                    ? "text-emerald-300"
                                    : "text-purple-300"
                                }`}
                              >
                                {isValidDate
                                  ? eventDate.toLocaleDateString("tr-TR", {
                                      month: "short",
                                    })
                                  : "-"}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {isValidDate ? eventDate.getFullYear() : ""}
                              </span>
                            </div>

                            {/* Etkinlik Bilgisi */}
                            <div className="flex-1 min-w-0">
                              <h3
                                className={`text-lg font-semibold transition-colors truncate ${
                                  isReady && isFuture
                                    ? "text-white group-hover:text-emerald-300"
                                    : "text-white group-hover:text-purple-300"
                                }`}
                              >
                                {event.name}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="text-sm">
                                    {event.time ||
                                      (isValidDate
                                        ? eventDate.toLocaleTimeString(
                                            "tr-TR",
                                            {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            }
                                          )
                                        : "-")}
                                  </span>
                                </div>
                                {event.venue?.name && (
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="text-sm truncate max-w-[150px]">
                                      {event.venue.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Geri Sayım veya Durum Badge */}
                            <div className="flex-shrink-0 flex items-center gap-3">
                              {isReady && countdown && isFuture ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                                      {String(countdown.days).padStart(2, "0")}
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                      GÜN
                                    </span>
                                  </div>
                                  <span className="text-emerald-500 font-bold">
                                    :
                                  </span>
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                                      {String(countdown.hours).padStart(2, "0")}
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                      SAAT
                                    </span>
                                  </div>
                                  <span className="text-emerald-500 font-bold">
                                    :
                                  </span>
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                                      {String(countdown.minutes).padStart(
                                        2,
                                        "0"
                                      )}
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                      DK
                                    </span>
                                  </div>
                                  <span className="text-emerald-500 font-bold">
                                    :
                                  </span>
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                                      {String(countdown.seconds).padStart(
                                        2,
                                        "0"
                                      )}
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                      SN
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`px-3 py-1.5 text-sm ${
                                    hasTeam
                                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  }`}
                                >
                                  {hasTeam ? "✓ Tamamlandı" : "⏳ Bekliyor"}
                                </Badge>
                              )}
                              <ChevronRight
                                className={`w-5 h-5 transition-colors ${
                                  isReady && isFuture
                                    ? "text-emerald-500 group-hover:text-emerald-400"
                                    : "text-slate-500 group-hover:text-purple-400"
                                }`}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Personel Oluştur/Düzenle Modal */}
        <StaffFormDialog
          open={showCreateModal || !!editingStaff}
          staff={editingStaff}
          roles={roles}
          onClose={() => {
            setShowCreateModal(false);
            setEditingStaff(null);
          }}
          onSave={() => {
            loadStaff();
            setShowCreateModal(false);
            setEditingStaff(null);
          }}
        />

        {/* Personel Detay Modal */}
        <Dialog
          open={!!viewingStaff}
          onOpenChange={() => setViewingStaff(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Personel Detayı</DialogTitle>
            </DialogHeader>
            {viewingStaff && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    className="w-16 h-16 border-2"
                    style={{ borderColor: viewingStaff.color || "#3b82f6" }}
                  >
                    <AvatarImage
                      src={getAvatarUrl(viewingStaff.avatar)}
                      alt={viewingStaff.fullName}
                    />
                    <AvatarFallback
                      style={{
                        backgroundColor: viewingStaff.color || "#3b82f6",
                      }}
                      className="text-white font-bold text-xl"
                    >
                      {viewingStaff.fullName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {viewingStaff.fullName}
                    </h3>
                    {viewingStaff.position && (
                      <Badge
                        variant="outline"
                        className={getRoleBadgeColor(viewingStaff.position)}
                      >
                        {getRoleLabel(viewingStaff.position)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-white">{viewingStaff.email}</span>
                  </div>
                  {viewingStaff.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-white">{viewingStaff.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                    <Shield className="w-4 h-4 text-slate-400" />
                    <span className="text-white">
                      Durum: {viewingStaff.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewingStaff(null)}
                className="border-slate-600"
              >
                Kapat
              </Button>
              <Button
                onClick={() => {
                  setEditingStaff(viewingStaff);
                  setViewingStaff(null);
                }}
                className="bg-purple-600"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Personel Silme Onay */}
        <Dialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Personeli Sil</DialogTitle>
              <DialogDescription className="text-slate-400">
                <strong className="text-white">
                  {deleteConfirm?.fullName}
                </strong>{" "}
                isimli personeli silmek istediğinizden emin misiniz? Bu işlem
                geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button variant="destructive" onClick={handleDeleteStaff}>
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ekip Oluştur/Düzenle Modal */}
        <TeamFormDialog
          open={showTeamModal || !!editingTeam}
          team={editingTeam}
          staff={staff}
          roles={roles}
          onClose={() => {
            setShowTeamModal(false);
            setEditingTeam(null);
          }}
          onSave={() => {
            loadTeams();
            setShowTeamModal(false);
            setEditingTeam(null);
          }}
        />

        {/* Ekip Silme Onay */}
        <Dialog
          open={!!deleteTeamConfirm}
          onOpenChange={() => setDeleteTeamConfirm(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Ekibi Sil</DialogTitle>
              <DialogDescription className="text-slate-400">
                <strong className="text-white">
                  {deleteTeamConfirm?.name}
                </strong>{" "}
                ekibini silmek istediğinizden emin misiniz?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTeamConfirm(null)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button variant="destructive" onClick={handleDeleteTeam}>
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Personel Rolleri Modal */}
        <RolesModal
          open={showRolesModal}
          onClose={() => setShowRolesModal(false)}
          staff={staff}
          roles={roles}
          onRolesChange={setRoles}
        />

        {/* Toplu Yükleme Bilgi Modal (Confirm) */}
        <BulkUploadInfoModal
          open={showBulkUploadInfo}
          onClose={() => setShowBulkUploadInfo(false)}
          onConfirm={() => {
            setShowBulkUploadInfo(false);
            setShowBulkUploadModal(true);
          }}
          roles={roles}
        />

        {/* Toplu Yükleme Modal */}
        <BulkUploadModal
          open={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          roles={roles}
          onSuccess={() => {
            loadStaff();
            setShowBulkUploadModal(false);
          }}
        />

        {/* Çalışma Saatleri Modal */}
        <ShiftsModal
          open={showShiftsModal}
          onClose={() => setShowShiftsModal(false)}
          shifts={shifts}
          onShiftsChange={setShifts}
        />

        {/* Personel Konum Görüntüleme Modal */}
        <Dialog
          open={showStaffLocationModal}
          onOpenChange={(open) => {
            setShowStaffLocationModal(open);
            if (!open) {
              setSelectedMemberForLocation(null);
              setMemberEventAssignments([]);
              setSelectedEventForLocation(null);
              setEventVenueLayout(null);
            }
          }}
        >
          <DialogContent className="!max-w-[950px] !h-[85vh] bg-slate-800 border-slate-700 overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={getAvatarUrl(selectedMemberForLocation?.avatar)}
                  />
                  <AvatarFallback
                    style={{
                      backgroundColor:
                        selectedMemberForLocation?.color || "#3b82f6",
                    }}
                    className="text-white text-sm"
                  >
                    {selectedMemberForLocation?.fullName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span>{selectedMemberForLocation?.fullName}</span>
                <span className="text-slate-400 font-normal">
                  - Görev Konumları
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-600 text-slate-300 ml-auto"
                >
                  {memberEventAssignments.length} etkinlik ataması
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Personelin atandığı etkinlikleri ve yerleşim planındaki
                konumlarını görüntüleyin
              </DialogDescription>
            </DialogHeader>

            {selectedMemberForLocation && (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* İki Sütunlu Layout */}
                <div className="flex-1 grid grid-cols-3 gap-4 min-h-0 overflow-hidden">
                  {/* Sol: Etkinlik Listesi */}
                  <div className="col-span-1 flex flex-col overflow-hidden">
                    <p className="text-xs text-slate-400 mb-2 font-medium">
                      Atandığı Etkinlikler
                    </p>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {memberEventAssignments.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Henüz atama yok</p>
                        </div>
                      ) : (
                        memberEventAssignments.map((assignment: any) => (
                          <div
                            key={assignment.id}
                            onClick={() =>
                              handleSelectEventForLocation(assignment)
                            }
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                              selectedEventForLocation?.id === assignment.id
                                ? "bg-emerald-600/20 border-emerald-500"
                                : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                            }`}
                          >
                            <p className="text-xs font-medium text-white truncate">
                              {assignment.event?.name || "Etkinlik"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {assignment.event?.eventDate
                                ? new Date(
                                    assignment.event.eventDate
                                  ).toLocaleDateString("tr-TR")
                                : "-"}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5">
                              <Badge
                                variant="secondary"
                                className="text-[9px] bg-slate-600 text-slate-300"
                              >
                                {assignment.tableIds?.length || 0} masa
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sağ: Yerleşim Planı */}
                  <div className="col-span-2 flex flex-col overflow-hidden">
                    <p className="text-xs text-slate-400 mb-2 font-medium">
                      Yerleşim Planı
                    </p>
                    <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden relative">
                      {!selectedEventForLocation ? (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                          <div className="text-center">
                            <Eye className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">
                              Yerleşim planını görmek için
                              <br />
                              bir etkinlik seçin
                            </p>
                          </div>
                        </div>
                      ) : loadingEventLayout ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-slate-400">
                              Yükleniyor...
                            </p>
                          </div>
                        </div>
                      ) : !eventVenueLayout?.placedTables?.length ? (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                          <div className="text-center">
                            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">
                              Bu etkinlikte yerleşim planı yok
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="absolute inset-0 overflow-auto p-4"
                          style={{ minHeight: "350px" }}
                        >
                          <div
                            style={{
                              width: 900 * 0.55,
                              height: 680 * 0.55,
                              position: "relative",
                              transform: "scale(0.55)",
                              transformOrigin: "top left",
                            }}
                          >
                            {/* Stage Elements */}
                            {(eventVenueLayout.stageElements || []).map(
                              (element: any) => (
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
                              )
                            )}

                            {/* Masalar */}
                            {(eventVenueLayout.placedTables || [])
                              .filter((t: any) => !t.isLoca)
                              .map((table: any) => {
                                const isAssigned =
                                  selectedEventForLocation?.tableIds?.includes(
                                    table.id
                                  );
                                const staffColor =
                                  selectedMemberForLocation?.color || "#10b981";

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
                                        isAssigned
                                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-125 z-10"
                                          : "opacity-25"
                                      }`}
                                      style={{
                                        backgroundColor: isAssigned
                                          ? staffColor
                                          : "#4b5563",
                                        borderColor: isAssigned
                                          ? "#10b981"
                                          : "#6b7280",
                                      }}
                                    >
                                      <span
                                        className={`text-[9px] font-bold ${
                                          isAssigned
                                            ? "text-white"
                                            : "text-slate-400"
                                        }`}
                                      >
                                        {table.tableNumber || ""}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Localar */}
                            {(eventVenueLayout.placedTables || [])
                              .filter((t: any) => t.isLoca)
                              .map((loca: any) => {
                                const isAssigned =
                                  selectedEventForLocation?.tableIds?.includes(
                                    loca.id
                                  );
                                const staffColor =
                                  selectedMemberForLocation?.color || "#10b981";

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
                                        isAssigned
                                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 z-10"
                                          : "opacity-25"
                                      }`}
                                      style={{
                                        width: 56,
                                        height: 32,
                                        backgroundColor: isAssigned
                                          ? staffColor
                                          : "#4b5563",
                                        borderColor: isAssigned
                                          ? "#10b981"
                                          : "#6b7280",
                                      }}
                                    >
                                      <span
                                        className={`text-[9px] font-bold ${
                                          isAssigned
                                            ? "text-white"
                                            : "text-slate-400"
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
                                className="w-3 h-3 rounded-full border-2 border-emerald-500"
                                style={{
                                  backgroundColor:
                                    selectedMemberForLocation?.color ||
                                    "#10b981",
                                }}
                              />
                              <span className="text-slate-300">Atanmış</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded-full bg-gray-600 opacity-40" />
                              <span className="text-slate-400">Diğer</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seçili Etkinlik Masa Listesi */}
                {selectedEventForLocation &&
                  selectedEventForLocation.tableIds?.length > 0 && (
                    <div className="p-2.5 bg-slate-700/50 rounded-lg">
                      <p className="text-[10px] text-slate-400 mb-1.5">
                        {selectedEventForLocation.event?.name} - Atanmış
                        Masalar:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedEventForLocation.tableIds
                          .slice(0, 15)
                          .map((tableId: string) => {
                            const table = eventVenueLayout?.placedTables?.find(
                              (t: any) => t.id === tableId
                            );
                            const label =
                              table?.tableNumber ||
                              tableId.match(/-(\d+)$/)?.[1] ||
                              tableId.slice(-3);
                            return (
                              <Badge
                                key={tableId}
                                variant="secondary"
                                className="text-[10px]"
                                style={{
                                  backgroundColor: `${
                                    selectedMemberForLocation?.color ||
                                    "#10b981"
                                  }30`,
                                  color:
                                    selectedMemberForLocation?.color ||
                                    "#10b981",
                                }}
                              >
                                {label}
                              </Badge>
                            );
                          })}
                        {selectedEventForLocation.tableIds.length > 15 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-600 text-slate-300"
                          >
                            +{selectedEventForLocation.tableIds.length - 15}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowStaffLocationModal(false);
                  setSelectedMemberForLocation(null);
                  setMemberEventAssignments([]);
                  setSelectedEventForLocation(null);
                  setEventVenueLayout(null);
                }}
                className="border-slate-600 text-slate-300"
              >
                Kapat
              </Button>
              {selectedEventForLocation && (
                <Button
                  onClick={() => {
                    router.push(
                      `/events/${selectedEventForLocation.eventId}/team-organization`
                    );
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Etkinliğe Git
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}

// Personel Form Dialog
function StaffFormDialog({
  open,
  staff,
  roles,
  onClose,
  onSave,
}: {
  open: boolean;
  staff: Staff | null;
  roles: Role[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    position: "",
    color: "#3b82f6",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const colors = [
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];

  useEffect(() => {
    if (open) {
      if (staff) {
        setFormData({
          fullName: staff.fullName,
          email: staff.email,
          phone: staff.phone || "",
          password: "",
          position: staff.position || "",
          color: staff.color || "#3b82f6",
          isActive: staff.isActive,
        });
      } else {
        setFormData({
          fullName: "",
          email: "",
          phone: "",
          password: "",
          position: "",
          color: "#3b82f6",
          isActive: true,
        });
      }
      setError("");
    }
  }, [open, staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.fullName.trim()) {
      setError("Ad soyad zorunludur");
      return;
    }
    if (!formData.email.trim()) {
      setError("E-posta zorunludur");
      return;
    }
    if (!formData.position) {
      setError("Görev seçimi zorunludur");
      return;
    }

    // Yeni personel için şifre zorunlu
    if (!staff && !formData.password.trim()) {
      setError("Şifre zorunludur");
      return;
    }

    setSaving(true);
    try {
      if (staff) {
        // Güncelleme - password hariç
        await staffApi.update(staff.id, {
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          color: formData.color,
          position: formData.position as any,
          isActive: formData.isActive,
        });
      } else {
        // Yeni oluşturma - password dahil
        await staffApi.create({
          email: formData.email,
          fullName: formData.fullName,
          password: formData.password,
          phone: formData.phone || undefined,
          color: formData.color,
          position: formData.position as any,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Personel Düzenle" : "Yeni Personel"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personel bilgilerini girin
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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

          <div className="space-y-2">
            <Label>E-posta *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="ornek@email.com"
              className="bg-slate-700 border-slate-600"
              disabled={!!staff}
            />
          </div>

          {!staff && (
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
          )}

          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="555-0000"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          <div className="space-y-2">
            <Label>Görev *</Label>
            <Select
              value={formData.position}
              onValueChange={(v) => setFormData({ ...formData, position: v })}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Görev seçin" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {roles.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Renk</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
              disabled={saving}
            >
              İptal
            </Button>
            <Button type="submit" className="bg-purple-600" disabled={saving}>
              {saving ? "Kaydediliyor..." : staff ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ekip Form Dialog
function TeamFormDialog({
  open,
  team,
  staff,
  roles,
  onClose,
  onSave,
}: {
  open: boolean;
  team: Team | null;
  staff: Staff[];
  roles: Role[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    color: "#3b82f6",
    leaderId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const colors = [
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];

  // Lider olabilecek personeller (Captan veya Süpervizör)
  const leaderCandidates = staff.filter(
    (s) => s.position === "captan" || s.position === "supervizor"
  );

  useEffect(() => {
    if (open) {
      if (team) {
        setFormData({
          name: team.name,
          color: team.color,
          leaderId: team.leaderId || "",
        });
      } else {
        setFormData({
          name: "",
          color: "#3b82f6",
          leaderId: "",
        });
      }
      setError("");
    }
  }, [open, team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Ekip adı zorunludur");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        color: formData.color,
        leaderId: formData.leaderId || undefined,
        memberIds: team?.memberIds || [],
      };

      if (team) {
        await staffApi.updateNewTeam(team.id, payload);
      } else {
        await staffApi.createNewTeam(payload);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle>{team ? "Ekip Düzenle" : "Yeni Ekip"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Ekip bilgilerini girin
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Ekip Adı *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Örn: A Takımı"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          <div className="space-y-2">
            <Label>Ekip Rengi</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ekip Lideri</Label>
            <Select
              value={formData.leaderId || "none"}
              onValueChange={(v) =>
                setFormData({ ...formData, leaderId: v === "none" ? "" : v })
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Lider seçin (opsiyonel)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="none">Seçilmedi</SelectItem>
                {leaderCandidates.map((s) => {
                  const roleLabel =
                    roles.find((r) => r.key === s.position)?.label ||
                    s.position;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.fullName}
                        <span className="text-slate-400 text-xs">
                          ({roleLabel})
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {leaderCandidates.length === 0 && (
              <p className="text-xs text-slate-500">
                Lider atamak için önce Captan veya Süpervizör rolünde personel
                ekleyin
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
              disabled={saving}
            >
              İptal
            </Button>
            <Button type="submit" className="bg-purple-600" disabled={saving}>
              {saving ? "Kaydediliyor..." : team ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Personel Rolleri Modal
function RolesModal({
  open,
  onClose,
  staff,
  roles,
  onRolesChange,
}: {
  open: boolean;
  onClose: () => void;
  staff: Staff[];
  roles: Role[];
  onRolesChange: (roles: Role[]) => void;
}) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRoleMode, setNewRoleMode] = useState(false);
  const [newRole, setNewRole] = useState({ label: "", color: "#3b82f6" });
  const [saving, setSaving] = useState(false);

  const colors = [
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  const getStaffCountByRole = (roleKey: string) => {
    return staff.filter((s) => s.position === roleKey).length;
  };

  // API: Rol güncelle
  const handleSaveEdit = async () => {
    if (!editingRole || !editingRole.id) return;
    setSaving(true);
    try {
      const response = await staffApi.updateRole(editingRole.id, {
        label: editingRole.label,
        color: editingRole.color,
      });
      // State'i güncelle (key ile eşleştir)
      const updatedRoles = roles.map((r) =>
        r.key === editingRole.key ? response.data : r
      );
      onRolesChange(updatedRoles);
      setEditingRole(null);
    } catch (error) {
      console.error("Rol güncellenemedi:", error);
      alert("Rol güncellenirken hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  // API: Yeni rol oluştur
  const handleAddRole = async () => {
    if (!newRole.label.trim()) return;
    const key = newRole.label
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (roles.some((r) => r.key === key)) {
      alert("Bu isimde bir rol zaten var");
      return;
    }

    setSaving(true);
    try {
      const response = await staffApi.createRole({
        key,
        label: newRole.label,
        color: newRole.color,
      });
      onRolesChange([...roles, response.data]);
      setNewRole({ label: "", color: "#3b82f6" });
      setNewRoleMode(false);
    } catch (error: any) {
      console.error("Rol oluşturulamadı:", error);
      alert(error.response?.data?.message || "Rol oluşturulurken hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  // API: Rol sil
  const handleDeleteRole = async (role: Role) => {
    const count = getStaffCountByRole(role.key);
    if (count > 0) {
      alert(
        `Bu rolde ${count} personel var. Önce personellerin rolünü değiştirin.`
      );
      return;
    }

    if (!role.id) {
      alert("Bu rol henüz veritabanına kaydedilmemiş");
      return;
    }

    setSaving(true);
    try {
      await staffApi.deleteRole(role.id);
      // State'den key ile sil (daha güvenilir)
      onRolesChange(roles.filter((r) => r.key !== role.key));
    } catch (error: any) {
      console.error("Rol silinemedi:", error);
      alert(error.response?.data?.message || "Rol silinirken hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Personel Rolleri
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personel görev tanımlarını yönetin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {roles.map((role) => {
            const staffCount = getStaffCountByRole(role.key);
            const isEditing = editingRole?.key === role.key;

            return (
              <div
                key={role.key}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-3">
                    <Input
                      value={editingRole.label}
                      onChange={(e) =>
                        setEditingRole({
                          ...editingRole,
                          label: e.target.value,
                        })
                      }
                      className="bg-slate-600 border-slate-500 h-8 w-40"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setEditingRole({ ...editingRole, color: c })
                          }
                          className={`w-5 h-5 rounded-full border-2 ${
                            editingRole.color === c
                              ? "border-white"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      className="bg-green-600 hover:bg-green-700 h-7 px-2"
                      disabled={saving}
                    >
                      {saving ? "..." : "Kaydet"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRole(null)}
                      className="h-7 px-2"
                      disabled={saving}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium text-white">
                        {role.label}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-slate-600/50 text-slate-300 border-slate-500 text-xs"
                      >
                        {staffCount} kişi
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={() => setEditingRole(role)}
                        disabled={saving}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => handleDeleteRole(role)}
                        disabled={staffCount > 0 || saving}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Yeni Rol Ekleme */}
          {newRoleMode ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-dashed border-slate-500">
              <Input
                value={newRole.label}
                onChange={(e) =>
                  setNewRole({ ...newRole, label: e.target.value })
                }
                placeholder="Rol adı"
                className="bg-slate-600 border-slate-500 h-8 w-40"
                autoFocus
              />
              <div className="flex gap-1">
                {colors.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewRole({ ...newRole, color: c })}
                    className={`w-5 h-5 rounded-full border-2 ${
                      newRole.color === c
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleAddRole}
                className="bg-purple-600 hover:bg-purple-700 h-7 px-2"
                disabled={!newRole.label.trim() || saving}
              >
                {saving ? "..." : "Ekle"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewRoleMode(false);
                  setNewRole({ label: "", color: "#3b82f6" });
                }}
                className="h-7 px-2"
                disabled={saving}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
              onClick={() => setNewRoleMode(true)}
              disabled={saving}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Rol Ekle
            </Button>
          )}
        </div>

        <DialogFooter>
          <p className="text-xs text-green-500 flex-1">
            ✓ Değişiklikler veritabanına kaydedilir
          </p>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Toplu Yükleme Bilgi Modal (Confirm)
function BulkUploadInfoModal({
  open,
  onClose,
  onConfirm,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  roles: Role[];
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-400" />
            Excel ile Toplu Personel Yükleme
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-300">
            Yükleyeceğiniz Excel dosyasında aşağıdaki sütunlar mutlaka
            bulunmalıdır:
          </p>

          {/* Sütun Tablosu */}
          <div className="bg-slate-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700">
                  <th className="px-3 py-2 text-left text-slate-300">
                    Sütun Adı
                  </th>
                  <th className="px-3 py-2 text-left text-slate-300">
                    Açıklama
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="px-3 py-2">
                    <code className="text-green-400">fullName</code>
                  </td>
                  <td className="px-3 py-2 text-slate-400">Ad Soyad</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    <code className="text-green-400">email</code>
                  </td>
                  <td className="px-3 py-2 text-slate-400">E-posta</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    <code className="text-green-400">position</code>
                  </td>
                  <td className="px-3 py-2 text-slate-400">Rol (key)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Örnek Tablo */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Örnek:</p>
            <div className="bg-slate-900 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-700">
                    <th className="px-2 py-1.5 text-left text-slate-300">
                      fullName
                    </th>
                    <th className="px-2 py-1.5 text-left text-slate-300">
                      email
                    </th>
                    <th className="px-2 py-1.5 text-left text-slate-300">
                      position
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-400">
                  <tr>
                    <td className="px-2 py-1.5">Ahmet Yılmaz</td>
                    <td className="px-2 py-1.5">ahmet@email.com</td>
                    <td className="px-2 py-1.5">garson</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5">Mehmet Demir</td>
                    <td className="px-2 py-1.5">mehmet@email.com</td>
                    <td className="px-2 py-1.5">komi</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mevcut Roller */}
          {roles.length > 0 && (
            <div className="text-xs">
              <span className="text-slate-500">Kullanılabilir roller: </span>
              <span className="text-purple-400">
                {roles.map((r) => r.key).join(", ")}
              </span>
            </div>
          )}

          {roles.length === 0 && (
            <p className="text-xs text-red-400">
              ⚠️ Önce &quot;Personel Rolleri&quot; butonundan rol eklemelisiniz!
            </p>
          )}

          <p className="text-xs text-slate-500">
            * Tüm personellere varsayılan şifre &quot;123456&quot; atanacaktır.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
          >
            İptal
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700"
            disabled={roles.length === 0}
          >
            <Upload className="w-4 h-4 mr-2" />
            Devam Et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Toplu Yükleme Modal
function BulkUploadModal({
  open,
  onClose,
  roles,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && isValidExcelFile(droppedFile)) {
      setFile(droppedFile);
      setResults(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidExcelFile(selectedFile)) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const isValidExcelFile = (f: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    return (
      validTypes.includes(f.type) ||
      f.name.endsWith(".xlsx") ||
      f.name.endsWith(".xls") ||
      f.name.endsWith(".csv")
    );
  };

  const parseExcelFile = async (f: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          resolve(jsonData);
        } catch (err) {
          reject(new Error("Excel dosyası okunamadı"));
        }
      };
      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsBinaryString(f);
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResults(null);

    try {
      const data = await parseExcelFile(file);

      if (data.length === 0) {
        setResults({
          success: 0,
          failed: 0,
          errors: ["Dosyada veri bulunamadı"],
        });
        return;
      }

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of data) {
        try {
          // Validasyon - sadece fullName, email, position gerekli
          if (!row.fullName?.trim()) {
            errors.push(`Satır atlandı: fullName eksik`);
            failed++;
            continue;
          }
          if (!row.email?.trim()) {
            errors.push(`${row.fullName}: email eksik`);
            failed++;
            continue;
          }
          if (!row.position?.trim()) {
            errors.push(`${row.fullName}: position eksik`);
            failed++;
            continue;
          }
          if (!roles.some((r) => r.key === row.position.trim())) {
            errors.push(`${row.fullName}: geçersiz position "${row.position}"`);
            failed++;
            continue;
          }

          // API'ye gönder - şifre varsayılan "123456"
          await staffApi.create({
            fullName: row.fullName.trim(),
            email: row.email.trim(),
            password: "123456",
            position: row.position.trim(),
          });
          success++;
        } catch (err: any) {
          const msg = err.response?.data?.message || "Bilinmeyen hata";
          errors.push(`${row.fullName || "?"}: ${msg}`);
          failed++;
        }
      }

      setResults({ success, failed, errors });

      if (success > 0 && failed === 0) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      setResults({
        success: 0,
        failed: 0,
        errors: [err.message || "Dosya işlenemedi"],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-400" />
            Toplu Personel Yükle
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Excel (.xlsx, .xls) veya CSV dosyanızı sürükleyip bırakın
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drag & Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-green-500 bg-green-500/10"
                : file
                ? "border-green-600 bg-green-600/10"
                : "border-slate-600 hover:border-slate-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-green-400" />
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4 mr-1" />
                  Kaldır
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-slate-500" />
                <p className="text-slate-400">
                  Excel dosyasını buraya sürükleyin
                </p>
                <p className="text-xs text-slate-500">(.xlsx, .xls, .csv)</p>
                <label className="cursor-pointer">
                  <span className="text-green-400 hover:text-green-300 text-sm">
                    Dosya Seç
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">
                  ✓ {results.success} başarılı
                </span>
                {results.failed > 0 && (
                  <span className="text-red-400">
                    ✗ {results.failed} başarısız
                  </span>
                )}
              </div>
              {results.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {results.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-red-400">
                      • {err}
                    </p>
                  ))}
                  {results.errors.length > 10 && (
                    <p className="text-xs text-red-400 mt-1">
                      ... ve {results.errors.length - 10} hata daha
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-slate-600"
            disabled={uploading}
          >
            {results?.success ? "Kapat" : "İptal"}
          </Button>
          {!results?.success && (
            <Button
              onClick={handleUpload}
              className="bg-green-600 hover:bg-green-700"
              disabled={!file || uploading}
            >
              {uploading ? (
                <>Yükleniyor...</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Yükle
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Çalışma Saatleri Modal
function ShiftsModal({
  open,
  onClose,
  shifts,
  onShiftsChange,
}: {
  open: boolean;
  onClose: () => void;
  shifts: WorkShift[];
  onShiftsChange: (shifts: WorkShift[]) => void;
}) {
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [newShiftMode, setNewShiftMode] = useState(false);
  const [newShift, setNewShift] = useState({
    name: "",
    startTime: "09:00",
    endTime: "17:00",
    color: "#3b82f6",
  });
  const [saving, setSaving] = useState(false);

  // Genişletilmiş renk paleti - vardiyalar için
  const colors = [
    "#ef4444", // Kırmızı
    "#f97316", // Turuncu
    "#f59e0b", // Amber
    "#eab308", // Sarı
    "#84cc16", // Lime
    "#22c55e", // Yeşil
    "#10b981", // Emerald
    "#14b8a6", // Teal
    "#06b6d4", // Cyan
    "#0ea5e9", // Sky
    "#3b82f6", // Mavi
    "#6366f1", // İndigo
    "#8b5cf6", // Mor
    "#a855f7", // Purple
    "#d946ef", // Fuşya
    "#ec4899", // Pembe
    "#f43f5e", // Rose
    "#78716c", // Stone
  ];

  // Saat formatla (HH:mm)
  const formatTime = (time: string) => {
    if (!time) return "";
    // "HH:mm:ss" formatından "HH:mm" formatına
    return time.substring(0, 5);
  };

  // API: Yeni çalışma saati oluştur
  const handleAddShift = async () => {
    if (!newShift.name.trim()) return;
    if (!newShift.startTime || !newShift.endTime) return;

    setSaving(true);
    try {
      const response = await staffApi.createShift({
        name: newShift.name,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        color: newShift.color,
      });
      onShiftsChange([...shifts, response.data]);
      setNewShift({
        name: "",
        startTime: "09:00",
        endTime: "17:00",
        color: "#3b82f6",
      });
      setNewShiftMode(false);
    } catch (error: any) {
      console.error("Çalışma saati oluşturulamadı:", error);
      alert(
        error.response?.data?.message ||
          "Çalışma saati oluşturulurken hata oluştu"
      );
    } finally {
      setSaving(false);
    }
  };

  // API: Çalışma saati güncelle
  const handleSaveEdit = async () => {
    if (!editingShift) return;
    setSaving(true);
    try {
      const response = await staffApi.updateShift(editingShift.id, {
        name: editingShift.name,
        startTime: editingShift.startTime,
        endTime: editingShift.endTime,
        color: editingShift.color,
      });
      const updatedShifts = shifts.map((s) =>
        s.id === editingShift.id ? response.data : s
      );
      onShiftsChange(updatedShifts);
      setEditingShift(null);
    } catch (error: any) {
      console.error("Çalışma saati güncellenemedi:", error);
      alert(
        error.response?.data?.message ||
          "Çalışma saati güncellenirken hata oluştu"
      );
    } finally {
      setSaving(false);
    }
  };

  // API: Çalışma saati sil
  const handleDeleteShift = async (shift: WorkShift) => {
    if (
      !confirm(
        `"${shift.name}" çalışma saatini silmek istediğinizden emin misiniz?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await staffApi.deleteShift(shift.id);
      onShiftsChange(shifts.filter((s) => s.id !== shift.id));
    } catch (error: any) {
      console.error("Çalışma saati silinemedi:", error);
      alert(
        error.response?.data?.message || "Çalışma saati silinirken hata oluştu"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Çalışma Saatleri
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personel çalışma saat aralıklarını yönetin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {shifts.length === 0 && !newShiftMode && (
            <div className="text-center py-8 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Henüz çalışma saati tanımlanmamış</p>
            </div>
          )}

          {shifts.map((shift) => {
            const isEditing = editingShift?.id === shift.id;

            return (
              <div
                key={shift.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingShift.name}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            name: e.target.value,
                          })
                        }
                        placeholder="Vardiya adı"
                        className="bg-slate-600 border-slate-500 h-8 flex-1"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={formatTime(editingShift.startTime)}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            startTime: e.target.value,
                          })
                        }
                        className="bg-slate-600 border-slate-500 h-8 w-28"
                      />
                      <span className="text-slate-400">-</span>
                      <Input
                        type="time"
                        value={formatTime(editingShift.endTime)}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            endTime: e.target.value,
                          })
                        }
                        className="bg-slate-600 border-slate-500 h-8 w-28"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {colors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setEditingShift({ ...editingShift, color: c })
                            }
                            className={`w-5 h-5 rounded-full border-2 ${
                              editingShift.color === c
                                ? "border-white"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="bg-green-600 hover:bg-green-700 h-7 px-2"
                        disabled={saving}
                      >
                        {saving ? "..." : "Kaydet"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingShift(null)}
                        className="h-7 px-2"
                        disabled={saving}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: shift.color }}
                      />
                      <div>
                        <span className="font-medium text-white">
                          {shift.name}
                        </span>
                        <div className="text-xs text-slate-400">
                          {formatTime(shift.startTime)} -{" "}
                          {formatTime(shift.endTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={() => setEditingShift(shift)}
                        disabled={saving}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => handleDeleteShift(shift)}
                        disabled={saving}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Yeni Çalışma Saati Ekleme */}
          {newShiftMode ? (
            <div className="p-3 rounded-lg bg-slate-700/30 border border-dashed border-slate-500 space-y-2">
              <Input
                value={newShift.name}
                onChange={(e) =>
                  setNewShift({ ...newShift, name: e.target.value })
                }
                placeholder="Vardiya adı (örn: Sabah Vardiyası)"
                className="bg-slate-600 border-slate-500 h-8"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) =>
                    setNewShift({ ...newShift, startTime: e.target.value })
                  }
                  className="bg-slate-600 border-slate-500 h-8 w-28"
                />
                <span className="text-slate-400">-</span>
                <Input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) =>
                    setNewShift({ ...newShift, endTime: e.target.value })
                  }
                  className="bg-slate-600 border-slate-500 h-8 w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewShift({ ...newShift, color: c })}
                      className={`w-5 h-5 rounded-full border-2 ${
                        newShift.color === c
                          ? "border-white"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex-1" />
                <Button
                  size="sm"
                  onClick={handleAddShift}
                  className="bg-blue-600 hover:bg-blue-700 h-7 px-2"
                  disabled={!newShift.name.trim() || saving}
                >
                  {saving ? "..." : "Ekle"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNewShiftMode(false);
                    setNewShift({
                      name: "",
                      startTime: "09:00",
                      endTime: "17:00",
                      color: "#3b82f6",
                    });
                  }}
                  className="h-7 px-2"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
              onClick={() => setNewShiftMode(true)}
              disabled={saving}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Çalışma Saati Ekle
            </Button>
          )}
        </div>

        <DialogFooter>
          <p className="text-xs text-green-500 flex-1">
            ✓ Değişiklikler veritabanına kaydedilir
          </p>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
