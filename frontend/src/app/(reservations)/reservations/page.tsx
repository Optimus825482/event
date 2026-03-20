"use client";

import { useEffect, useState, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Clock,
  ArrowRight,
  Ticket,
  Search,
  MapPin,
  UserCheck,
  QrCode,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

interface Event {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  totalCapacity?: number;
  venueLayout?: {
    tables?: any[];
  };
  reservationCount?: number;
  checkedInCount?: number;
}

// Geri Sayım — tablet için optimize edilmiş hero versiyonu
const HeroCountdown = memo(function HeroCountdown({
  eventDate,
}: {
  eventDate: string;
}) {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const update = () => {
      const diff = new Date(eventDate).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  const units = [
    { value: countdown.days, label: "GÜN" },
    { value: countdown.hours, label: "SAAT" },
    { value: countdown.minutes, label: "DAKİKA" },
    { value: countdown.seconds, label: "SANİYE" },
  ];

  return (
    <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-4 md:gap-6">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-4">
          <div className="text-center">
            <div className="relative">
              {/* Tablet için daha büyük sayılar */}
              <span className="text-5xl sm:text-6xl md:text-7xl font-bold tabular-nums bg-gradient-to-b from-white via-purple-100 to-purple-300 bg-clip-text text-transparent drop-shadow-2xl">
                {String(u.value).padStart(2, "0")}
              </span>
              {/* Glow efekti */}
              <div className="absolute inset-0 text-5xl sm:text-6xl md:text-7xl font-bold tabular-nums text-purple-500/20 blur-xl select-none">
                {String(u.value).padStart(2, "0")}
              </div>
            </div>
            <span className="text-[10px] sm:text-xs tracking-[0.2em] text-purple-300/80 mt-2 block font-medium">
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="text-3xl sm:text-4xl text-purple-500/60 font-light -mt-6 drop-shadow-lg">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

export default function ReservationsDashboardPage() {
  const router = useRouter();
  const { setActiveModule } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await eventsApi.getAll();
        const data = res.data;
        const allEvents = Array.isArray(data) ? data : data?.items || [];

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const upcoming = allEvents
          .filter((e: Event) => {
            const d = new Date(e.eventDate);
            d.setHours(0, 0, 0, 0);
            return d >= now && e.status !== "cancelled";
          })
          .sort(
            (a: Event, b: Event) =>
              new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
          );

        setEvents(upcoming);
      } catch (err) {
        console.error("Veriler yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => e.name.toLowerCase().includes(q));
  }, [events, searchQuery]);

  const nextEvent = events[0];

  // Bugünkü etkinlikler
  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return events.filter((e) => {
      const d = new Date(e.eventDate);
      d.setHours(0, 0, 0, 0);
      return d >= today && d < tomorrow;
    }).length;
  }, [events]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageContainer>
      <div className="space-y-6 md:space-y-8 pb-8">
        {/* Hero — Yaklaşan Etkinlik (Tablet için optimize) */}
        {nextEvent ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/50 to-slate-900 border border-purple-500/30 shadow-2xl shadow-purple-500/10">
            {/* Dekoratif arka plan - tablet için daha belirgin */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-32 -right-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
              {/* Grid pattern overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
            </div>

            <div className="relative p-6 sm:p-8 md:p-10">
              {/* Üst kısım — Etiket + Check-in butonu */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-purple-400 animate-ping" />
                  </div>
                  <span className="text-sm tracking-[0.2em] text-purple-300/80 uppercase font-medium">
                    Yaklaşan Etkinlik
                  </span>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white gap-3 shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => {
                    setActiveModule("checkin");
                    setTimeout(() => router.push("/check-in"), 50);
                  }}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="font-semibold">Check-in Modülü</span>
                </Button>
              </div>

              {/* Etkinlik adı - tablet için daha büyük */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 md:mb-3 tracking-tight leading-tight">
                {nextEvent.name}
              </h2>
              <p className="text-base sm:text-lg text-purple-300/70 mb-8 md:mb-10 font-medium">
                {formatDate(nextEvent.eventDate, "long")}
              </p>

              {/* Geri sayım */}
              <div className="mb-8 md:mb-10">
                <HeroCountdown eventDate={nextEvent.eventDate} />
              </div>

              {/* Alt bilgi çubuğu - tablet için 2 satır */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <Button
                  size="lg"
                  className="h-14 px-8 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white gap-3 shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => router.push(`/reservations/${nextEvent.id}`)}
                >
                  <Ticket className="w-5 h-5" />
                  <span className="font-semibold">Rezervasyonları Yönet</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>

                <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm md:text-base text-slate-400">
                  {nextEvent.venueLayout?.tables && (
                    <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">{nextEvent.venueLayout.tables.length}</span> masa
                    </span>
                  )}
                  {nextEvent.totalCapacity && (
                    <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">{nextEvent.totalCapacity}</span> kapasite
                    </span>
                  )}
                  <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                    <Ticket className="w-4 h-4 text-purple-400" />
                    <span className="font-medium">{nextEvent.reservationCount || 0}</span> rezervasyon
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-20 text-center">
              <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-6" />
              <p className="text-lg text-slate-400">Yaklaşan etkinlik bulunmuyor</p>
            </CardContent>
          </Card>
        )}

        {/* Hızlı İstatistikler - Tablet için 2x2 grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <QuickStat
            icon={<Calendar className="w-5 h-5 md:w-6 md:h-6" />}
            value={events.length}
            label="Yaklaşan Etkinlik"
            color="purple"
            trend={events.length > 0 ? "up" : "neutral"}
          />
          <QuickStat
            icon={<Clock className="w-5 h-5 md:w-6 md:h-6" />}
            value={todayCount}
            label="Bugün"
            color="amber"
            trend={todayCount > 0 ? "hot" : "neutral"}
          />
          <QuickStat
            icon={<UserCheck className="w-5 h-5 md:w-6 md:h-6" />}
            value={0}
            label="Check-in"
            color="emerald"
            trend="neutral"
            className="col-span-2 md:col-span-1"
          />
        </div>

        {/* Etkinlik Listesi — tablet için card-based */}
        {events.length > 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base md:text-lg font-semibold text-white tracking-wide">
                Tüm Yaklaşan Etkinlikler
              </h3>
              <Badge
                variant="outline"
                className="text-sm border-purple-500/30 text-purple-300 px-3 py-1"
              >
                {filteredEvents.length}
              </Badge>
            </div>

            {/* Arama — tablet için daha büyük */}
            {events.length > 2 && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Etkinlik ara..."
                  className="w-full h-14 bg-slate-800/50 border border-slate-700/50 rounded-2xl pl-12 pr-4 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
            )}

            {/* Grid layout - tablet için 2 sütun */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.slice(1).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

// Etkinlik kartı - tablet için card-based tasarım
function EventCard({ event }: { event: Event }) {
  const router = useRouter();
  const eventDate = new Date(event.eventDate);
  const now = new Date();
  const isToday = eventDate.toDateString() === now.toDateString();

  // Kalan gün hesapla
  const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / 86400000);

  const tableCount = event.venueLayout?.tables?.length || 0;
  const reservationRate = event.totalCapacity
    ? Math.round(((event.reservationCount || 0) / event.totalCapacity) * 100)
    : 0;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300
        ${
          isToday
            ? "bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-slate-800/80 border-2 border-purple-500/40 hover:border-purple-400/60 shadow-lg shadow-purple-500/10"
            : "bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/50 hover:shadow-lg"
        }`}
      onClick={() => router.push(`/reservations/${event.id}`)}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isToday ? "bg-gradient-to-t from-purple-500/10 to-transparent" : "bg-gradient-to-t from-slate-700/20 to-transparent"}`} />

      <div className="relative p-5 md:p-6">
        {/* Üst kısım - Tarih ve Badge */}
        <div className="flex items-start justify-between mb-4">
          {/* Tarih bloğu - tablet için daha büyük */}
          <div
            className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg
            ${isToday ? "bg-purple-500/30 border border-purple-400/30" : "bg-slate-700/50 border border-slate-600/30"}`}
          >
            <span
              className={`text-2xl md:text-3xl font-bold leading-none
              ${isToday ? "text-purple-200" : "text-white"}`}
            >
              {eventDate.getDate()}
            </span>
            <span className="text-xs text-slate-400 uppercase mt-1 font-medium">
              {eventDate.toLocaleDateString("tr-TR", { month: "short" })}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2">
            {isToday && (
              <Badge className="bg-purple-500/30 text-purple-200 border border-purple-400/30 text-xs px-3 py-1 font-medium">
                BUGÜN
              </Badge>
            )}
            <span className={`text-sm font-medium px-3 py-1 rounded-lg ${
              diffDays <= 1 ? "bg-amber-500/20 text-amber-300" :
              diffDays <= 3 ? "bg-blue-500/20 text-blue-300" :
              "bg-slate-700/50 text-slate-400"
            }`}>
              {diffDays === 0 ? "Bugün" : diffDays === 1 ? "Yarın" : `${diffDays} gün`}
            </span>
          </div>
        </div>

        {/* Etkinlik adı */}
        <h4 className="text-lg md:text-xl font-semibold text-white mb-3 group-hover:text-purple-300 transition-colors line-clamp-2">
          {event.name}
        </h4>

        {/* Alt bilgiler */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-4">
          <span className="flex items-center gap-1.5 bg-slate-700/30 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            {eventDate.toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {tableCount > 0 && (
            <span className="flex items-center gap-1.5 bg-slate-700/30 px-2.5 py-1 rounded-lg">
              <MapPin className="w-3.5 h-3.5" />
              {tableCount} masa
            </span>
          )}
        </div>

        {/* Doluluk çubuğu */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Rezervasyon</span>
            <span className="font-semibold text-white">{event.reservationCount || 0}</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                reservationRate >= 80 ? "bg-gradient-to-r from-red-500 to-orange-500" :
                reservationRate >= 50 ? "bg-gradient-to-r from-amber-500 to-yellow-500" :
                "bg-gradient-to-r from-emerald-500 to-teal-500"
              }`}
              style={{ width: `${Math.min(reservationRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Action hint */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Hızlı istatistik kartı - tablet için optimize
function QuickStat({
  icon,
  value,
  label,
  color,
  trend,
  className = "",
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: "purple" | "amber" | "emerald";
  trend?: "up" | "down" | "hot" | "neutral";
  className?: string;
}) {
  const colors = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/30 shadow-purple-500/10",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30 shadow-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10",
  };

  const trendColors = {
    up: "bg-gradient-to-br from-emerald-500/20 to-transparent",
    down: "bg-gradient-to-br from-red-500/20 to-transparent",
    hot: "bg-gradient-to-br from-amber-500/20 to-transparent",
    neutral: "",
  };

  return (
    <div
      className={`relative overflow-hidden flex items-center gap-4 p-4 md:p-5 rounded-2xl border ${colors[color]} shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${className}`}
    >
      {/* Trend gradient */}
      {trend && trend !== "neutral" && (
        <div className={`absolute inset-0 ${trendColors[trend]} opacity-50`} />
      )}

      <div className="relative flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-slate-800/50 flex items-center justify-center">
        {icon}
      </div>
      <div className="relative">
        <span className="text-3xl md:text-4xl font-bold text-white">{value}</span>
        <span className="block text-sm text-slate-400 mt-0.5 font-medium">{label}</span>
      </div>
    </div>
  );
}

// Skeleton
function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Skeleton className="h-64 w-full bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
