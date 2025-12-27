"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Timer,
  ArrowLeft,
  Edit,
  Eye,
  LayoutGrid,
  UsersRound,
  Table2,
  Crown,
  Star,
  Circle,
  Sofa,
  Loader2,
  ClipboardList,
  CalendarCheck,
} from "lucide-react";
import { eventsApi, staffApi, adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast-notification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Event {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  status: string;
  venueLayout?: any;
  hasVenueLayout?: boolean;
  hasTeamAssignment?: boolean;
  totalCapacity?: number;
  reviewEnabled?: boolean;
  reviewHistoryVisible?: boolean;
  reservationEnabled?: boolean;
}

interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  members?: any[]; // Backend'den gelen hesaplanmış üye listesi
  assignedGroupCount?: number;
  assignedTableCount?: number;
}

interface TableGroup {
  id: string;
  tableIds: string[];
  assignedTeamId?: string;
}

// Masa tipi renkleri
const TABLE_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  unassigned: {
    bg: "bg-slate-500/20",
    text: "text-slate-400",
    label: "Atanmamış",
  },
  standard: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Standart" },
  premium: {
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    label: "Premium",
  },
  vip: { bg: "bg-amber-500/20", text: "text-amber-400", label: "VIP" },
  loca: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Loca" },
};

export default function EventSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Ayar güncelleme fonksiyonu
  const handleSettingChange = async (
    setting: "reviewEnabled" | "reviewHistoryVisible" | "reservationEnabled",
    value: boolean
  ) => {
    if (!event) return;

    try {
      setSavingSettings(true);

      // Review ayarları için adminApi kullan (bildirim tetiklemesi için)
      if (setting === "reviewEnabled" || setting === "reviewHistoryVisible") {
        await adminApi.updateEventReviewSettings(eventId, { [setting]: value });
      } else {
        // Diğer ayarlar için eventsApi kullan
        await eventsApi.update(eventId, { [setting]: value });
      }

      setEvent((prev) => (prev ? { ...prev, [setting]: value } : null));
      toast.success(
        value ? "Özellik aktifleştirildi" : "Özellik devre dışı bırakıldı"
      );
    } catch (error) {
      console.error("Ayar güncellenemedi:", error);
      toast.error("Ayar güncellenemedi");
    } finally {
      setSavingSettings(false);
    }
  };

  // Veri yükleme
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, teamsRes, tableGroupsRes] = await Promise.all([
          eventsApi.getOne(eventId),
          staffApi.getTeams().catch(() => ({ data: [] })),
          staffApi.getEventTableGroups(eventId).catch(() => ({ data: [] })),
        ]);

        setEvent(eventRes.data);
        setTeams(teamsRes.data || []);
        setTableGroups(tableGroupsRes.data || []);
      } catch (error) {
        console.error("Veri yüklenemedi:", error);
        router.push("/events");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, router]);

  // Geri sayım timer
  useEffect(() => {
    if (!event) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(event.eventDate).getTime();
      const diff = eventTime - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  // Masa istatistikleri hesaplama
  const getTableStats = () => {
    const tables =
      event?.venueLayout?.placedTables || event?.venueLayout?.tables || [];
    const stats: Record<string, { count: number; capacity: number }> = {};

    tables.forEach((table: any) => {
      const type = table.type || "unassigned";
      if (!stats[type]) {
        stats[type] = { count: 0, capacity: 0 };
      }
      stats[type].count++;
      stats[type].capacity += table.capacity || 0;
    });

    return stats;
  };

  // Ekip istatistikleri hesaplama - SADECE BU ETKİNLİĞE AİT tableGroups'a göre
  const getTeamStats = () => {
    const tables =
      event?.venueLayout?.placedTables || event?.venueLayout?.tables || [];
    const groups = tableGroups || [];

    // SADECE bu etkinliğe ait tableGroups'tan hesapla
    // Backend'den gelen assignedTableCount TÜM etkinlikleri içerdiği için kullanmıyoruz
    return teams
      .map((team) => {
        // Bu etkinliğe ait ve bu ekibe atanmış grupları bul
        const assignedGroups = groups.filter(
          (g) => g.assignedTeamId === team.id
        );
        const assignedTableIds = assignedGroups.flatMap(
          (g) => g.tableIds || []
        );
        const assignedTables = tables.filter((t: any) =>
          assignedTableIds.includes(t.id)
        );
        const totalCapacity = assignedTables.reduce(
          (sum: number, t: any) => sum + (t.capacity || 0),
          0
        );

        return {
          ...team,
          tableCount: assignedTables.length,
          capacity: totalCapacity,
          memberCount: team.members?.length || team.memberIds?.length || 0,
        };
      })
      .filter((t) => t.tableCount > 0);
  };

  const tableStats = getTableStats();
  const teamStats = getTeamStats();
  const tables =
    event?.venueLayout?.placedTables || event?.venueLayout?.tables || [];
  const totalTables = tables.filter((t: any) => !t.isLoca).length;
  const totalCapacity = tables.reduce(
    (sum: number, t: any) => sum + (t.capacity || 0),
    0
  );
  const hasVenueLayout = tables.length > 0;

  // hasTeamAssignment: backend'den gelen değer VEYA tableGroups'ta ekibe atanmış grup varsa
  const hasAssignedGroups = tableGroups.some((g) => g.assignedTeamId);
  const hasTeamAssignment =
    event?.hasTeamAssignment || hasAssignedGroups || teamStats.length > 0;
  const isReady = hasVenueLayout && hasTeamAssignment;

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-20 w-full bg-slate-700 rounded-xl" />
          <Skeleton className="h-32 w-full bg-slate-700 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64 bg-slate-700 rounded-xl" />
            <Skeleton className="h-64 bg-slate-700 rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">Etkinlik bulunamadı</p>
          <Button asChild>
            <Link href="/events">Etkinliklere Dön</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header - Geri Butonu ve Etkinlik Bilgisi */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/events")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{event.name}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(event.eventDate).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {new Date(event.eventDate).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {event.eventType && (
                <Badge
                  variant="outline"
                  className="text-slate-400 border-slate-600"
                >
                  {event.eventType}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Geri Sayım - Sadece hazır etkinlikler için */}
        {isReady && (
          <Card className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10 border-emerald-500/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">
                      Etkinliğe Kalan Süre
                    </p>
                    <p className="text-sm font-medium text-emerald-400">
                      Planlama Tamamlandı
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-3 py-1.5">
                  <CountdownUnit value={countdown.days} label="GÜN" />
                  <span className="text-emerald-500 font-bold">:</span>
                  <CountdownUnit value={countdown.hours} label="SAAT" />
                  <span className="text-emerald-500 font-bold">:</span>
                  <CountdownUnit value={countdown.minutes} label="DK" />
                  <span className="text-emerald-500 font-bold">:</span>
                  <CountdownUnit value={countdown.seconds} label="SN" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etkinlik Ayarları - Geri sayımın hemen altında, yan yana 3'lü grid */}
        {isReady && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rezervasyon Sistemi */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <CalendarCheck className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Rezervasyon Sistemi
                      </p>
                      <p className="text-xs text-slate-400">
                        Bu etkinlik için rezervasyon alınabilsin
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={event?.reservationEnabled ?? true}
                      onCheckedChange={(checked) =>
                        handleSettingChange("reservationEnabled", checked)
                      }
                      disabled={savingSettings}
                    />
                    <span
                      className={`text-xs font-medium ${
                        event?.reservationEnabled !== false
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                    >
                      {event?.reservationEnabled !== false ? "Açık" : "Kapalı"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ekip Değerlendirme Sistemi */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Ekip Değerlendirme
                      </p>
                      <p className="text-xs text-slate-400">
                        Liderler personel değerlendirmesi yapabilsin
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={event?.reviewEnabled || false}
                      onCheckedChange={(checked) =>
                        handleSettingChange("reviewEnabled", checked)
                      }
                      disabled={savingSettings}
                    />
                    <span
                      className={`text-xs font-medium ${
                        event?.reviewEnabled
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                    >
                      {event?.reviewEnabled ? "Açık" : "Kapalı"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Geçmiş Değerlendirmeler Görünürlüğü */}
            <Card
              className={`bg-slate-800/50 border-slate-700 transition-opacity ${
                !event?.reviewEnabled ? "opacity-50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Geçmiş Değerlendirmeler
                      </p>
                      <p className="text-xs text-slate-400">
                        Liderler önceki değerlendirmeleri görebilsin
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={event?.reviewHistoryVisible || false}
                      onCheckedChange={(checked) =>
                        handleSettingChange("reviewHistoryVisible", checked)
                      }
                      disabled={savingSettings || !event?.reviewEnabled}
                    />
                    <span
                      className={`text-xs font-medium ${
                        event?.reviewHistoryVisible
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                    >
                      {event?.reviewHistoryVisible ? "Görünür" : "Gizli"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ana İçerik - İki Sütun */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sol - Yerleşim Planı Özeti */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-400" />
                  Yerleşim Planı
                </CardTitle>
                {hasVenueLayout ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Tamamlandı
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Bekliyor
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasVenueLayout ? (
                <>
                  {/* Genel İstatistikler */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {totalTables}
                      </p>
                      <p className="text-xs text-slate-400">Toplam Masa</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {totalCapacity}
                      </p>
                      <p className="text-xs text-slate-400">Toplam Kapasite</p>
                    </div>
                  </div>

                  {/* Masa Tipleri */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300">
                      Masa Tipleri
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(tableStats).map(([type, data]) => {
                        const config =
                          TABLE_TYPE_COLORS[type] ||
                          TABLE_TYPE_COLORS.unassigned;
                        return (
                          <div
                            key={type}
                            className={`flex items-center justify-between ${config.bg} rounded-lg px-3 py-2`}
                          >
                            <div className="flex items-center gap-2">
                              <TableTypeIcon type={type} />
                              <span className={`text-sm ${config.text}`}>
                                {config.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-slate-400">
                                {data.count} masa
                              </span>
                              <span className={config.text}>
                                {data.capacity} kişi
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Butonlar */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVenueModal(true)}
                      className="flex-1 border-slate-600"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Önizle
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Link href={`/events/${eventId}/venue`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Düzenle
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 mb-4">
                    Yerleşim planı henüz oluşturulmadı
                  </p>
                  <Button asChild className="bg-green-600 hover:bg-green-700">
                    <Link href={`/events/${eventId}/venue`}>
                      <LayoutGrid className="w-4 h-4 mr-2" />
                      Yerleşim Planı Oluştur
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sağ - Ekip Organizasyonu Özeti */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <UsersRound className="w-5 h-5 text-purple-400" />
                  Ekip Organizasyonu
                </CardTitle>
                {hasTeamAssignment ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Tamamlandı
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Bekliyor
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasTeamAssignment && teamStats.length > 0 ? (
                <>
                  {/* Genel İstatistikler */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {teamStats.length}
                      </p>
                      <p className="text-xs text-slate-400">Aktif Ekip</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {teamStats.reduce((sum, t) => sum + t.memberCount, 0)}
                      </p>
                      <p className="text-xs text-slate-400">Toplam Personel</p>
                    </div>
                  </div>

                  {/* Ekip Listesi */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300">
                      Ekipler
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {teamStats.map((team) => (
                        <div
                          key={team.id}
                          className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="text-sm text-white">
                              {team.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-slate-400">
                              {team.memberCount} kişi
                            </span>
                            <span className="text-purple-400">
                              {team.tableCount} masa
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Butonlar */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTeamModal(true)}
                      className="flex-1 border-slate-600"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Önizle
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      <Link href={`/events/${eventId}/team-organization`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Düzenle
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <UsersRound className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 mb-4">
                    {hasVenueLayout
                      ? "Ekip organizasyonu henüz yapılmadı"
                      : "Önce yerleşim planı oluşturun"}
                  </p>
                  <Button
                    asChild
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!hasVenueLayout}
                  >
                    <Link href={`/events/${eventId}/team-organization`}>
                      <Users className="w-4 h-4 mr-2" />
                      Ekip Organizasyonu Yap
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Hızlı Erişim Butonları */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                variant="outline"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Link href={`/events/${eventId}/venue`}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Yerleşim Planı
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Link href={`/events/${eventId}/team-organization`}>
                  <Users className="w-4 h-4 mr-2" />
                  Ekip Organizasyonu
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
              >
                <Link href={`/events/${eventId}/invitation`}>
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  E-Davetiye
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Yerleşim Planı Önizleme Modal */}
        <VenuePreviewModal
          open={showVenueModal}
          onClose={() => setShowVenueModal(false)}
          tables={tables}
          event={event}
        />

        {/* Ekip Organizasyonu Önizleme Modal */}
        <TeamPreviewModal
          open={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          tables={tables}
          teams={teams}
          tableGroups={tableGroups}
          event={event}
        />
      </div>
    </PageContainer>
  );
}

// Geri sayım birimi
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <span className="text-lg font-bold text-emerald-400 tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] text-slate-500 block">{label}</span>
    </div>
  );
}

// Masa tipi ikonu
function TableTypeIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "vip":
      return <Crown className={`${iconClass} text-amber-400`} />;
    case "premium":
      return <Star className={`${iconClass} text-purple-400`} />;
    case "standard":
      return <Table2 className={`${iconClass} text-blue-400`} />;
    case "loca":
      return <Sofa className={`${iconClass} text-pink-400`} />;
    default:
      return <Circle className={`${iconClass} text-slate-400`} />;
  }
}

// Yerleşim Planı Önizleme Modal
function VenuePreviewModal({
  open,
  onClose,
  tables,
  event,
}: {
  open: boolean;
  onClose: () => void;
  tables: any[];
  event: Event;
}) {
  if (!open) return null;

  const canvasWidth = event.venueLayout?.dimensions?.width || 1050;
  const canvasHeight = event.venueLayout?.dimensions?.height || 680;
  const scale = Math.min(800 / canvasWidth, 500 / canvasHeight);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[900px] bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            Yerleşim Planı Önizleme
          </DialogTitle>
        </DialogHeader>
        <div
          className="relative bg-slate-900 rounded-lg overflow-hidden"
          style={{ height: "520px" }}
        >
          <div
            className="absolute left-1/2 top-1/2 border border-slate-600 rounded"
            style={{
              width: canvasWidth * scale,
              height: canvasHeight * scale,
              transform: "translate(-50%, -49%)",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            }}
          >
            {/* Sahne elemanları */}
            {event.venueLayout?.stageElements?.map((stage: any) => (
              <div
                key={stage.id}
                className="absolute flex items-center justify-center text-xs font-medium"
                style={{
                  left: stage.x * scale,
                  top: stage.y * scale,
                  width: stage.width * scale,
                  height: stage.height * scale,
                  backgroundColor:
                    stage.type === "system_control" ? "#dc2626" : "#3b82f6",
                  opacity: 0.8,
                  borderRadius: "4px",
                }}
              >
                <span className="text-white text-[10px]">{stage.label}</span>
              </div>
            ))}

            {/* Masalar */}
            {tables.map((table: any) => {
              const config =
                TABLE_TYPE_COLORS[table.type] || TABLE_TYPE_COLORS.unassigned;
              const isLoca = table.isLoca || table.type === "loca";
              const size = isLoca ? 16 : 20;

              return (
                <div
                  key={table.id}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: table.x * scale - size / 2,
                    top: table.y * scale - size / 2,
                    width: size,
                    height: isLoca ? 14 : size,
                    backgroundColor:
                      table.type === "unassigned"
                        ? "#475569"
                        : table.type === "vip"
                        ? "#f59e0b"
                        : table.type === "premium"
                        ? "#8b5cf6"
                        : table.type === "standard"
                        ? "#3b82f6"
                        : table.type === "loca"
                        ? "#ec4899"
                        : "#475569",
                    borderRadius: isLoca ? "3px" : "50%",
                  }}
                >
                  <span className="text-white text-[8px] font-bold">
                    {isLoca ? table.locaName : table.tableNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
          <Button asChild className="bg-green-600 hover:bg-green-700">
            <Link href={`/events/${event.id}/venue`}>
              <Edit className="w-4 h-4 mr-2" />
              Düzenle
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Ekip Organizasyonu Önizleme Modal
function TeamPreviewModal({
  open,
  onClose,
  tables,
  teams,
  tableGroups,
  event,
}: {
  open: boolean;
  onClose: () => void;
  tables: any[];
  teams: Team[];
  tableGroups: TableGroup[];
  event: Event;
}) {
  if (!open) return null;

  const canvasWidth = event.venueLayout?.dimensions?.width || 1050;
  const canvasHeight = event.venueLayout?.dimensions?.height || 680;
  const scale = Math.min(800 / canvasWidth, 500 / canvasHeight);

  // Masa -> Ekip eşleştirmesi
  const getTableTeam = (tableId: string) => {
    const group = tableGroups.find((g) => g.tableIds?.includes(tableId));
    if (!group?.assignedTeamId) return null;
    return teams.find((t) => t.id === group.assignedTeamId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[900px] bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-purple-400" />
            Ekip Organizasyonu Önizleme
          </DialogTitle>
        </DialogHeader>
        <div
          className="relative bg-slate-900 rounded-lg overflow-hidden"
          style={{ height: "520px" }}
        >
          <div
            className="absolute left-1/2 top-1/2 border border-slate-600 rounded"
            style={{
              width: canvasWidth * scale,
              height: canvasHeight * scale,
              transform: "translate(-50%, -49%)",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            }}
          >
            {/* Sahne elemanları */}
            {event.venueLayout?.stageElements?.map((stage: any) => (
              <div
                key={stage.id}
                className="absolute flex items-center justify-center text-xs font-medium"
                style={{
                  left: stage.x * scale,
                  top: stage.y * scale,
                  width: stage.width * scale,
                  height: stage.height * scale,
                  backgroundColor:
                    stage.type === "system_control" ? "#dc2626" : "#3b82f6",
                  opacity: 0.8,
                  borderRadius: "4px",
                }}
              >
                <span className="text-white text-[10px]">{stage.label}</span>
              </div>
            ))}

            {/* Masalar - Ekip renkleriyle */}
            {tables.map((table: any) => {
              const team = getTableTeam(table.id);
              const isLoca = table.isLoca || table.type === "loca";
              const size = isLoca ? 16 : 20;

              return (
                <div
                  key={table.id}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: table.x * scale - size / 2,
                    top: table.y * scale - size / 2,
                    width: size,
                    height: isLoca ? 14 : size,
                    backgroundColor: team?.color || "#475569",
                    borderRadius: isLoca ? "3px" : "50%",
                    border: team ? "2px solid rgba(255,255,255,0.3)" : "none",
                  }}
                >
                  <span className="text-white text-[8px] font-bold">
                    {isLoca ? table.locaName : table.tableNumber}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Ekip Renk Açıklaması */}
          <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2">Ekipler</p>
            <div className="flex flex-wrap gap-2">
              {teams
                .filter((t) =>
                  tableGroups.some((g) => g.assignedTeamId === t.id)
                )
                .map((team) => (
                  <div key={team.id} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-xs text-white">{team.name}</span>
                  </div>
                ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-500" />
                <span className="text-xs text-slate-400">Atanmamış</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={`/events/${event.id}/team-organization`}>
              <Edit className="w-4 h-4 mr-2" />
              Düzenle
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
