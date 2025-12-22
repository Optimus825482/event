"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  MapPin,
  CheckCircle2,
  CalendarCheck,
  Timer,
  LayoutGrid,
  UsersRound,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { eventsApi, staffApi, venuesApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";

interface DashboardStats {
  totalEvents: number;
  completedEvents: number;
  upcomingEvents: number;
  draftEvents: number;
  totalStaff: number;
  totalTeams: number;
  venueTemplates: number;
  orgTemplates: number;
}

interface UpcomingEvent {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  hasVenueLayout: boolean;
  hasTeamAssignment: boolean;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<UpcomingEvent | null>(
    null
  );
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, staffRes, teamsRes, venuesRes] = await Promise.all([
          eventsApi.getAll().catch(() => ({ data: [] })),
          staffApi.getAll().catch(() => ({ data: [] })),
          staffApi.getTeams().catch(() => ({ data: [] })),
          venuesApi.getAll().catch(() => ({ data: [] })),
        ]);

        const events = eventsRes.data || [];
        const staff = staffRes.data || [];
        const teams = teamsRes.data || [];
        const venues = venuesRes.data || [];
        const now = new Date();

        // Etkinlik istatistikleri
        const completed = events.filter(
          (e: any) => e.status === "completed" || new Date(e.eventDate) < now
        );
        const upcoming = events.filter(
          (e: any) => new Date(e.eventDate) >= now && e.status !== "completed"
        );
        const draft = events.filter((e: any) => e.status === "draft");

        setStats({
          totalEvents: events.length,
          completedEvents: completed.length,
          upcomingEvents: upcoming.length,
          draftEvents: draft.length,
          totalStaff: staff.length,
          totalTeams: teams.length,
          venueTemplates: venues.length,
          orgTemplates: 0, // TODO: API'den çekilecek
        });

        // En yakın etkinliği bul (yerleşim planı ve ekip ataması tamamlanmış)
        const readyEvents = upcoming
          .filter((e: any) => {
            const hasVenue =
              e.venueLayout?.placedTables?.length > 0 || e.hasVenueLayout;
            const hasTeam = e.hasTeamAssignment;
            return hasVenue && hasTeam;
          })
          .sort(
            (a: any, b: any) =>
              new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
          );

        if (readyEvents.length > 0) {
          const event = readyEvents[0];
          setUpcomingEvent({
            id: event.id,
            name: event.name,
            eventDate: event.eventDate,
            status: event.status,
            hasVenueLayout:
              event.venueLayout?.placedTables?.length > 0 ||
              event.hasVenueLayout,
            hasTeamAssignment: event.hasTeamAssignment,
          });
        }
      } catch (error) {
        console.error("Dashboard verileri yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Geri sayım timer
  useEffect(() => {
    if (!upcomingEvent) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(upcomingEvent.eventDate).getTime();
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
  }, [upcomingEvent]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Hoşgeldin Başlık */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            EventFlow PRO Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Etkinlik planlama ve yönetim merkezi
          </p>
        </div>

        {/* Geri Sayım - Yaklaşan Etkinlik (Kompakt) */}
        {upcomingEvent && (
          <Card className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10 border-emerald-500/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4">
                {/* Sol - Etkinlik Bilgisi */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {upcomingEvent.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {new Date(upcomingEvent.eventDate).toLocaleDateString(
                        "tr-TR",
                        {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>

                {/* Orta - Geri Sayım (Kompakt) */}
                <div className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-3 py-1.5">
                  <div className="text-center">
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {String(countdown.days).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 block">GÜN</span>
                  </div>
                  <span className="text-emerald-500 font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {String(countdown.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      SAAT
                    </span>
                  </div>
                  <span className="text-emerald-500 font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {String(countdown.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 block">DK</span>
                  </div>
                  <span className="text-emerald-500 font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {String(countdown.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 block">SN</span>
                  </div>
                </div>

                {/* Sağ - Badge'ler ve Buton */}
                <div className="flex items-center gap-2">
                  {upcomingEvent.hasVenueLayout && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      Yerleşim
                    </Badge>
                  )}
                  {upcomingEvent.hasTeamAssignment && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      Ekip
                    </Badge>
                  )}
                  <Button
                    asChild
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 h-8"
                  >
                    <Link href={`/events/${upcomingEvent.id}`}>
                      Detaylar
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Calendar className="w-6 h-6" />}
            label="Toplam Etkinlik"
            value={stats?.totalEvents || 0}
            color="blue"
            href="/events"
          />
          <StatCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            label="Tamamlanan"
            value={stats?.completedEvents || 0}
            color="green"
            href="/events"
          />
          <StatCard
            icon={<CalendarCheck className="w-6 h-6" />}
            label="Yaklaşan"
            value={stats?.upcomingEvents || 0}
            color="amber"
            highlight
            href="/events"
          />
        </div>

        {/* Alt Kartlar - Ekip ve Şablonlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ekipler */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors">
            <CardContent className="p-5">
              <Link href="/staff" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <UsersRound className="w-6 h-6 text-purple-400" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Ekip Yönetimi
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">
                    <span className="text-purple-400 font-bold">
                      {stats?.totalStaff || 0}
                    </span>{" "}
                    Personel
                  </span>
                  <span className="text-slate-400">
                    <span className="text-purple-400 font-bold">
                      {stats?.totalTeams || 0}
                    </span>{" "}
                    Ekip
                  </span>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Yerleşim Şablonları */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-colors">
            <CardContent className="p-5">
              <Link href="/templates" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-green-400" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Yerleşim Şablonları
                </h3>
                <p className="text-sm text-slate-400">
                  <span className="text-green-400 font-bold">
                    {stats?.venueTemplates || 0}
                  </span>{" "}
                  şablon kayıtlı
                </p>
              </Link>
            </CardContent>
          </Card>

          {/* Organizasyon Şablonları */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors">
            <CardContent className="p-5">
              <Link href="/templates" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <LayoutGrid className="w-6 h-6 text-amber-400" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Ekip Atama Şablonları
                </h3>
                <p className="text-sm text-slate-400">
                  <span className="text-amber-400 font-bold">
                    {stats?.orgTemplates || 0}
                  </span>{" "}
                  şablon kayıtlı
                </p>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Hızlı Erişim */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Link href="/events/new">
                  <Calendar className="w-4 h-4 mr-2" />
                  Yeni Etkinlik
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Link href="/staff">
                  <Users className="w-4 h-4 mr-2" />
                  Ekip Yönetimi
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Link href="/templates">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Şablonlar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

// İstatistik Kartı
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "amber" | "slate" | "purple";
  highlight?: boolean;
  href: string;
}

const statColors = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    icon: "bg-blue-500/20",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    icon: "bg-green-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: "bg-amber-500/20",
  },
  slate: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    icon: "bg-slate-500/20",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    icon: "bg-purple-500/20",
  },
};

function StatCard({
  icon,
  label,
  value,
  color,
  highlight,
  href,
}: StatCardProps) {
  const colors = statColors[color];
  return (
    <Link href={href}>
      <Card
        className={`${highlight ? colors.bg : "bg-slate-800/50"} ${
          colors.border
        } border hover:scale-105 transition-transform cursor-pointer`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg ${colors.icon} flex items-center justify-center ${colors.text}`}
            >
              {icon}
            </div>
            <div>
              <p
                className={`text-2xl font-bold ${
                  highlight ? colors.text : "text-white"
                }`}
              >
                {value}
              </p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Skeleton
function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="text-center py-4">
          <Skeleton className="h-8 w-64 mx-auto mb-2 bg-slate-700" />
          <Skeleton className="h-4 w-48 mx-auto bg-slate-700" />
        </div>
        <Skeleton className="h-40 w-full bg-slate-700 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-slate-700 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 bg-slate-700 rounded-xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
