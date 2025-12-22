"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Settings,
  Activity,
  Database,
  Server,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  UserCog,
  FileText,
  BarChart3,
} from "lucide-react";
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
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface SystemStats {
  users: {
    total: number;
    active: number;
    admins: number;
    newThisMonth: number;
  };
  system: {
    uptime: string;
    version: string;
    lastBackup: string;
    dbSize: string;
  };
  activity: {
    todayLogins: number;
    activeNow: number;
    eventsCreated: number;
    reservationsToday: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simüle edilmiş veri yükleme
    const loadStats = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setStats({
        users: {
          total: 24,
          active: 18,
          admins: 3,
          newThisMonth: 5,
        },
        system: {
          uptime: "99.9%",
          version: "1.0.0",
          lastBackup: "2 saat önce",
          dbSize: "256 MB",
        },
        activity: {
          todayLogins: 12,
          activeNow: 4,
          eventsCreated: 8,
          reservationsToday: 45,
        },
      });
      setLoading(false);
    };

    loadStats();
  }, []);

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
        />

        {/* Ana İstatistikler */}
        <StatsGrid columns={4}>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Toplam Kullanıcı</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.users.total}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-400 border-green-500/30"
                >
                  {stats?.users.active} aktif
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30"
                >
                  {stats?.users.admins} admin
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Sistem Uptime</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.system.uptime}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-600/20 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Versiyon:{" "}
                  <span className="text-white">{stats?.system.version}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Bugünkü Giriş</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.activity.todayLogins}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-green-400">
                  {stats?.activity.activeNow} kullanıcı şu an aktif
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Veritabanı</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.system.dbSize}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-600/20 flex items-center justify-center">
                  <Database className="h-6 w-6 text-amber-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Son yedek:{" "}
                  <span className="text-white">{stats?.system.lastBackup}</span>
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
                  +{stats?.users.newThisMonth}
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
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">SMTP yapılandırıldı</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">SSL aktif</span>
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

          {/* Raporlar */}
          <Card className="bg-slate-800 border-slate-700 hover:border-purple-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                Raporlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Sistem kullanım raporları, aktivite logları ve istatistikler.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    Bugün oluşturulan etkinlik
                  </span>
                  <span className="text-white font-medium">
                    {stats?.activity.eventsCreated}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Bugünkü rezervasyon</span>
                  <span className="text-white font-medium">
                    {stats?.activity.reservationsToday}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                Raporları Görüntüle
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sistem Durumu */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Server className="w-5 h-5 text-green-400" />
              Sistem Durumu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">CPU Kullanımı</span>
                  <span className="text-sm text-white">23%</span>
                </div>
                <Progress value={23} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    Bellek Kullanımı
                  </span>
                  <span className="text-sm text-white">45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Disk Kullanımı</span>
                  <span className="text-sm text-white">62%</span>
                </div>
                <Progress value={62} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
