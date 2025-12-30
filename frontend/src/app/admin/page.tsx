"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Settings,
  Clock,
  CheckCircle2,
  UserCog,
  Bell,
  RefreshCw,
  Calendar,
  Loader2,
  Ticket,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageContainer,
  PageHeader,
  StatsGrid,
} from "@/components/ui/PageContainer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { adminApi, settingsApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface SystemStats {
  users: {
    total: number;
    active: number;
    admins: number;
    leaders: number;
    staff: number;
    newThisMonth: number;
  };
  events: {
    total: number;
    thisMonth: number;
    today: number;
    upcoming: number;
  };
  teams: {
    total: number;
    active: number;
  };
  reservations: {
    total: number;
    today: number;
    thisMonth: number;
  };
}

interface SettingsData {
  smtpHost: string | null;
  emailNotifications: boolean;
}

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setRefreshing(true);

        const [statsRes, settingsRes] = await Promise.all([
          adminApi.getStats(),
          settingsApi.get(),
        ]);

        setStats(statsRes.data);
        setSettings(settingsRes.data);
      } catch (error) {
        console.error("Dashboard verileri yüklenemedi:", error);
        toast.error("Dashboard verileri yüklenemedi");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <StatsGrid columns={4}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-slate-700 rounded-xl" />
            ))}
          </StatsGrid>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumb />

        <PageHeader
          title="Sistem Yönetimi"
          description="Kullanıcı yönetimi, sistem ayarları ve raporlar"
          icon={<Shield className="w-6 h-6 text-amber-400" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="border-slate-600"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          }
        />

        {/* Ana İstatistikler */}
        <StatsGrid columns={4}>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Toplam Kullanıcı</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.users.total ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-400 border-green-500/30"
                >
                  {stats?.users.active ?? 0} aktif
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30"
                >
                  {stats?.users.admins ?? 0} admin
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Toplam Etkinlik</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.events.total ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-green-400">
                  {stats?.events.upcoming ?? 0} yaklaşan etkinlik
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Toplam Rezervasyon</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.reservations?.total ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <Ticket className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Bugün:{" "}
                  <span className="text-white">
                    {stats?.reservations?.today ?? 0}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Aktif Takım</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.teams?.active ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-cyan-600/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Toplam:{" "}
                  <span className="text-white">{stats?.teams?.total ?? 0}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </StatsGrid>

        {/* Yönetim Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Kullanıcı Yönetimi */}
          <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-blue-400" />
                </div>
                Kullanıcı Yönetimi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Kullanıcı hesaplarını yönetin, roller atayın ve erişim
                izinlerini düzenleyin.
              </p>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">Bu ay yeni kayıt</span>
                <Badge className="bg-blue-500/20 text-blue-400">
                  +{stats?.users.newThisMonth ?? 0}
                </Badge>
              </div>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/users">
                  <Users className="w-4 h-4 mr-2" />
                  Kullanıcıları Yönet
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Sistem Ayarları */}
          <Card className="bg-slate-800 border-slate-700 hover:border-amber-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-amber-400" />
                </div>
                Sistem Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Genel sistem ayarları, e-posta yapılandırması ve entegrasyonlar.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {settings?.smtpHost ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-slate-300">
                    SMTP{" "}
                    {settings?.smtpHost ? "yapılandırıldı" : "yapılandırılmadı"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {settings?.emailNotifications ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-slate-300">
                    E-posta bildirimleri{" "}
                    {settings?.emailNotifications ? "aktif" : "kapalı"}
                  </span>
                </div>
              </div>
              <Button
                asChild
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                <Link href="/admin/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Ayarları Düzenle
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Bildirimler */}
          <Card className="bg-slate-800 border-slate-700 hover:border-purple-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-purple-400" />
                </div>
                Bildirimler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Sistem bildirimlerini görüntüle, takip et ve yönet.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Bu ay etkinlik</span>
                  <span className="text-white font-medium">
                    {stats?.events.thisMonth ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Bugün oluşturulan</span>
                  <span className="text-white font-medium">
                    {stats?.events.today ?? 0}
                  </span>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Link href="/admin/notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Bildirimleri Görüntüle
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Organizasyon Yönetimi */}
          <Card className="bg-slate-800 border-slate-700 hover:border-emerald-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                Organizasyon Yönetimi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Bölümler, unvanlar ve görev yerlerini yönetin. Departman
                ilişkilerini düzenleyin.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">Bölümler & Pozisyonlar</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">Görev Yerleri</span>
                </div>
              </div>
              <Button
                asChild
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Link href="/admin/organization">
                  <Building2 className="w-4 h-4 mr-2" />
                  Organizasyonu Yönet
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
