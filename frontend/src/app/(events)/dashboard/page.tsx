"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { eventsApi, staffApi, customersApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageContainer,
  PageHeader,
  StatsGrid,
} from "@/components/ui/PageContainer";

interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  totalStaff: number;
  totalCustomers: number;
  totalReservations: number;
}

interface UpcomingEvent {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  totalCapacity: number;
  reservedCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Paralel API çağrıları
        const [eventsRes, staffRes, customersRes] = await Promise.all([
          eventsApi.getAll().catch(() => ({ data: [] })),
          staffApi.getAll().catch(() => ({ data: [] })),
          customersApi.getAll().catch(() => ({ data: [] })),
        ]);

        const events = eventsRes.data || [];
        const now = new Date();

        // İstatistikleri hesapla
        const upcoming = events.filter(
          (e: any) => new Date(e.eventDate) > now && e.status !== "completed"
        );
        const completed = events.filter(
          (e: any) => e.status === "completed" || new Date(e.eventDate) < now
        );

        setStats({
          totalEvents: events.length,
          upcomingEvents: upcoming.length,
          completedEvents: completed.length,
          totalStaff: (staffRes.data || []).length,
          totalCustomers: (customersRes.data || []).length,
          totalReservations: events.reduce(
            (acc: number, e: any) => acc + (e.reservedCount || 0),
            0
          ),
        });

        // Yaklaşan etkinlikler (en yakın 5)
        setUpcomingEvents(
          upcoming
            .sort(
              (a: any, b: any) =>
                new Date(a.eventDate).getTime() -
                new Date(b.eventDate).getTime()
            )
            .slice(0, 5)
        );
      } catch (error) {
        console.error("Dashboard verileri yüklenemedi:", error);
        // Mock data
        setStats({
          totalEvents: 12,
          upcomingEvents: 5,
          completedEvents: 7,
          totalStaff: 24,
          totalCustomers: 156,
          totalReservations: 342,
        });
        setUpcomingEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Kalan gün hesaplama
  const getDaysRemaining = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <StatsGrid columns={4}>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 sm:p-6">
                  <Skeleton className="h-4 w-24 mb-2 bg-slate-700" />
                  <Skeleton className="h-8 w-16 bg-slate-700" />
                </CardContent>
              </Card>
            ))}
          </StatsGrid>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Başlık */}
        <PageHeader
          title="Dashboard"
          description="Etkinlik planlama genel görünümü"
          icon={<LayoutDashboard className="w-6 h-6 text-blue-400" />}
          actions={
            <Button asChild className="bg-blue-600 w-full sm:w-auto">
              <Link href="/events/new">
                <Plus className="w-4 h-4 mr-2" />
                Yeni Etkinlik
              </Link>
            </Button>
          }
        />

        {/* İstatistik Kartları */}
        <StatsGrid columns={4}>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Toplam Etkinlik
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {stats?.totalEvents || 0}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-400 border-green-500/30"
                >
                  {stats?.upcomingEvents || 0} yaklaşan
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-slate-500/10 text-slate-400 border-slate-500/30"
                >
                  {stats?.completedEvents || 0} tamamlanan
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">Personel</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {stats?.totalStaff || 0}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4">
                <Link
                  href="/staff"
                  className="text-xs sm:text-sm text-purple-400 flex items-center gap-1"
                >
                  Ekibi Yönet <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Misafirler
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {stats?.totalCustomers || 0}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-green-600/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4">
                <Link
                  href="/customers"
                  className="text-xs sm:text-sm text-green-400 flex items-center gap-1"
                >
                  CRM'e Git <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Toplam Rezervasyon
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {stats?.totalReservations || 0}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-amber-600/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4">
                <Link
                  href="/reservations"
                  className="text-xs sm:text-sm text-amber-400 flex items-center gap-1"
                >
                  Rezervasyonlar <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </StatsGrid>

        {/* Yaklaşan Etkinlikler ve Hızlı Erişim */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Yaklaşan Etkinlikler */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg font-semibold text-white">
                  Yaklaşan Etkinlikler
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    href="/events"
                    className="text-blue-400 text-xs sm:text-sm"
                  >
                    Tümünü Gör
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 mb-4 text-sm sm:text-base">
                      Yaklaşan etkinlik bulunmuyor
                    </p>
                    <Button asChild size="sm" className="bg-blue-600">
                      <Link href="/events/new">
                        <Plus className="w-4 h-4 mr-1" />
                        Etkinlik Oluştur
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {upcomingEvents.map((event) => {
                      const daysRemaining = getDaysRemaining(event.eventDate);
                      const fillRate =
                        event.totalCapacity > 0
                          ? ((event.reservedCount || 0) / event.totalCapacity) *
                            100
                          : 0;

                      return (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="block p-3 sm:p-4 rounded-lg bg-slate-700/50 border border-slate-600 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                            <div>
                              <h3 className="font-medium text-white text-sm sm:text-base">
                                {event.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-slate-400">
                                {new Date(event.eventDate).toLocaleDateString(
                                  "tr-TR",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`self-start text-xs ${
                                daysRemaining <= 3
                                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                                  : daysRemaining <= 7
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              {daysRemaining} gün
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-slate-400">Doluluk</span>
                              <span className="text-white">
                                {event.reservedCount || 0} /{" "}
                                {event.totalCapacity} kişi
                              </span>
                            </div>
                            <Progress value={fillRate} className="h-2" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hızlı Erişim */}
          <div className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg font-semibold text-white">
                  Hızlı Erişim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6">
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start border-slate-600 bg-slate-700/50 text-sm"
                >
                  <Link href="/events/new">
                    <Plus className="w-4 h-4 mr-2 text-blue-400" />
                    Yeni Etkinlik Oluştur
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start border-slate-600 bg-slate-700/50 text-sm"
                >
                  <Link href="/staff">
                    <Users className="w-4 h-4 mr-2 text-purple-400" />
                    Ekip Organizasyonu
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start border-slate-600 bg-slate-700/50 text-sm"
                >
                  <Link href="/venues">
                    <MapPin className="w-4 h-4 mr-2 text-green-400" />
                    Alan Şablonları
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start border-slate-600 bg-slate-700/50 text-sm"
                >
                  <Link href="/customers">
                    <TrendingUp className="w-4 h-4 mr-2 text-amber-400" />
                    Misafir Yönetimi
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Uyarılar */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  Hatırlatmalar
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3 text-sm">
                  {upcomingEvents.filter(
                    (e) => getDaysRemaining(e.eventDate) <= 3
                  ).length > 0 ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <p className="text-amber-400 text-xs sm:text-sm">
                        {
                          upcomingEvents.filter(
                            (e) => getDaysRemaining(e.eventDate) <= 3
                          ).length
                        }{" "}
                        etkinlik 3 gün içinde!
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4 text-xs sm:text-sm">
                      Acil hatırlatma yok
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
