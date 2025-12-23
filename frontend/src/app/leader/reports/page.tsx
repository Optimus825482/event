"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Star,
  Calendar,
  Award,
  Target,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Progress } from "@/components/ui/progress";
import { leaderApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface DashboardStats {
  totalTeams: number;
  totalMembers: number;
  upcomingEventsCount: number;
  assignedEventsCount: number;
}

interface Team {
  id: string;
  name: string;
  color: string;
  members: Array<{ id: string; fullName: string }>;
  memberCount?: number;
}

export default function LeaderReportsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaderApi.getDashboard();
      setStats(res.data.stats);
      setTeams(res.data.teams || []);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Raporlar"
          description="Ekip ve performans raporları"
          icon={<BarChart3 className="w-6 h-6 text-cyan-400" />}
        />

        {/* Özet İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Toplam Takım</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.totalTeams || 0}
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Ekip Üyesi</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.totalMembers || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Award className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Yaklaşan Etkinlik</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.upcomingEventsCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Atanan Etkinlik</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.assignedEventsCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-amber-500/20 rounded-lg">
                  <Target className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Takım Dağılımı */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Takım Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-10 h-10 text-slate-500 mb-3" />
                <p className="text-slate-400">Henüz takım bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => {
                  const memberCount =
                    team.members?.length || team.memberCount || 0;
                  const maxMembers = Math.max(
                    ...teams.map(
                      (t) => t.members?.length || t.memberCount || 0
                    ),
                    1
                  );
                  const percentage = (memberCount / maxMembers) * 100;

                  return (
                    <div key={team.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-white font-medium">
                            {team.name}
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {memberCount} üye
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performans Özeti */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Performans Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="text-6xl font-bold text-white mb-2">--</div>
                <p className="text-slate-400">Ortalama Puan</p>
                <p className="text-sm text-slate-500 mt-4">
                  Değerlendirme yapıldıkça veriler burada görünecek
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Trend Analizi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <Minus className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400">Trend verisi yok</p>
                <p className="text-sm text-slate-500 mt-2">
                  Yeterli değerlendirme yapıldığında trend analizi görünecek
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bilgi Notu */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-blue-400 font-medium">Raporlar Hakkında</p>
                <p className="text-sm text-blue-300/70 mt-1">
                  Detaylı performans raporları ve analizler, personel
                  değerlendirmeleri yapıldıkça otomatik olarak oluşturulacaktır.
                  Daha fazla veri toplandıkça grafikler ve trend analizleri
                  aktif hale gelecektir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
