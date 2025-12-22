"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  Award,
  UserCheck,
  AlertCircle,
  RefreshCw,
  LogOut,
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

interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  members: Array<{
    id: string;
    fullName: string;
    avatar?: string;
    color?: string;
    position?: string;
  }>;
}

interface Event {
  id: string;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  status: string;
  guestCount?: number;
}

interface DashboardData {
  leader: {
    id: string;
    fullName: string;
    avatar?: string;
    position?: string;
  };
  teams: Team[];
  upcomingEvents: Event[];
  assignedEvents: Event[];
  pastEventsForReview: Event[];
  stats: {
    totalTeams: number;
    totalMembers: number;
    upcomingEventsCount: number;
    assignedEventsCount: number;
  };
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex gap-2 text-center">
      <div className="bg-slate-700 rounded px-2 py-1">
        <div className="text-lg font-bold text-white">{timeLeft.days}</div>
        <div className="text-[10px] text-slate-400">GÜN</div>
      </div>
      <div className="bg-slate-700 rounded px-2 py-1">
        <div className="text-lg font-bold text-white">{timeLeft.hours}</div>
        <div className="text-[10px] text-slate-400">SAAT</div>
      </div>
      <div className="bg-slate-700 rounded px-2 py-1">
        <div className="text-lg font-bold text-white">{timeLeft.minutes}</div>
        <div className="text-[10px] text-slate-400">DK</div>
      </div>
    </div>
  );
}

export default function LeaderDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Zustand hydration kontrolü
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaderApi.getDashboard();
      setData(res.data);
    } catch (error: any) {
      console.error("Dashboard yüklenemedi:", error);
      if (error.response?.status === 403) {
        toast.error("Bu sayfaya erişim yetkiniz yok");
        router.push("/");
      } else {
        toast.error("Dashboard yüklenemedi");
      }
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    // Hydration tamamlanmadan kontrol yapma
    if (!isHydrated) return;

    // localStorage'dan direkt kontrol et (zustand persist bazen geç yükleniyor)
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        const storedUser = parsed?.state?.user;

        if (!storedUser) {
          router.push("/login");
          return;
        }

        if (storedUser.role !== "leader") {
          router.push("/select-module");
          return;
        }

        // User doğru, dashboard'u yükle
        loadDashboard();
      } catch (e) {
        console.error("Auth storage parse error:", e);
        router.push("/login");
      }
    } else if (!user) {
      router.push("/login");
    } else if (user.role !== "leader") {
      router.push("/select-module");
    } else {
      loadDashboard();
    }
  }, [isHydrated, user, loadDashboard, router]);

  // Hydration bekle
  if (!isHydrated) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 bg-slate-700 rounded-lg" />
            ))}
          </div>
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
          <p className="text-slate-400">Veriler yüklenemedi</p>
          <Button onClick={loadDashboard} className="mt-4">
            Tekrar Dene
          </Button>
        </div>
      </PageContainer>
    );
  }

  const nextEvent = data.assignedEvents.find(
    (e) => new Date(e.date) >= new Date()
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title={`Hoş geldin, ${data.leader.fullName}`}
          description="Lider Paneli"
          icon={<Award className="w-6 h-6 text-cyan-400" />}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboard}
                className="border-slate-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="border-red-600 text-red-400 hover:bg-red-600/20"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Çıkış
              </Button>
            </div>
          }
        />

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {data.stats.totalTeams}
                </div>
                <div className="text-xs text-slate-400">Takım</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {data.stats.totalMembers}
                </div>
                <div className="text-xs text-slate-400">Ekip Üyesi</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {data.stats.assignedEventsCount}
                </div>
                <div className="text-xs text-slate-400">Atanan Etkinlik</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {data.pastEventsForReview.length}
                </div>
                <div className="text-xs text-slate-400">
                  Değerlendirme Bekliyor
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Yaklaşan Etkinlik - Geri Sayım */}
          {nextEvent && (
            <Card className="bg-gradient-to-br from-cyan-900/30 to-slate-800 border-cyan-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Yaklaşan Etkinlik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {nextEvent.name}
                    </h3>
                    <p className="text-slate-400 text-sm flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(nextEvent.date).toLocaleDateString("tr-TR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    {nextEvent.startTime && (
                      <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" />
                        {nextEvent.startTime}
                        {nextEvent.endTime && ` - ${nextEvent.endTime}`}
                      </p>
                    )}
                  </div>
                  <CountdownTimer targetDate={nextEvent.date} />
                </div>
                <Button
                  className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => router.push(`/leader/events/${nextEvent.id}`)}
                >
                  Detayları Gör
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Takımlarım */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                Takımlarım
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.teams.length === 0 ? (
                <p className="text-slate-500 text-center py-4">
                  Henüz bir takıma atanmadınız
                </p>
              ) : (
                <div className="space-y-3">
                  {data.teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="font-medium text-white">
                            {team.name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {team.members.length} üye
                        </Badge>
                      </div>
                      <div className="flex -space-x-2">
                        {team.members.slice(0, 6).map((member) => (
                          <Avatar
                            key={member.id}
                            className="w-7 h-7 border-2 border-slate-800"
                          >
                            {member.avatar && (
                              <AvatarImage
                                src={`${API_BASE}${member.avatar}`}
                              />
                            )}
                            <AvatarFallback
                              className="text-[10px]"
                              style={{
                                backgroundColor: member.color || "#3b82f6",
                              }}
                            >
                              {member.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.members.length > 6 && (
                          <div className="w-7 h-7 rounded-full bg-slate-600 border-2 border-slate-800 flex items-center justify-center text-[10px] text-white">
                            +{team.members.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Atanan Etkinlikler */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Atanan Etkinlikler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.assignedEvents.length === 0 ? (
              <p className="text-slate-500 text-center py-4">
                Henüz bir etkinliğe atanmadınız
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.assignedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => router.push(`/leader/events/${event.id}`)}
                  >
                    <h4 className="font-medium text-white mb-1">
                      {event.name}
                    </h4>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString("tr-TR")}
                    </p>
                    {event.venue && (
                      <p className="text-sm text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.venue}
                      </p>
                    )}
                    <Badge
                      className={`mt-2 text-xs ${
                        event.status === "confirmed"
                          ? "bg-green-500/20 text-green-400"
                          : event.status === "planned"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {event.status === "confirmed"
                        ? "Onaylandı"
                        : event.status === "planned"
                        ? "Planlandı"
                        : event.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Değerlendirme Bekleyen Etkinlikler */}
        {data.pastEventsForReview.length > 0 && (
          <Card className="bg-slate-800/50 border-amber-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Performans Değerlendirmesi Bekleyen Etkinlikler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.pastEventsForReview.slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg hover:bg-amber-900/30 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(`/leader/events/${event.id}/review`)
                    }
                  >
                    <h4 className="font-medium text-white mb-1">
                      {event.name}
                    </h4>
                    <p className="text-sm text-slate-400">
                      {new Date(event.date).toLocaleDateString("tr-TR")}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 w-full bg-amber-600 hover:bg-amber-700"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Değerlendir
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
