"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Star,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Target,
  AlertCircle,
  Phone,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Progress } from "@/components/ui/progress";
import { leaderApi, API_BASE } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface PerformanceAnalysis {
  staffId: string;
  totalReviews: number;
  averageScore: number;
  averageRating: string | null;
  categoryAverages: Record<string, number> | null;
  trend: "improving" | "declining" | "stable";
  recentReviews: Array<{
    id: string;
    eventId: string;
    eventName?: string;
    eventDate?: string;
    score: number;
    rating: string;
    reviewerName?: string;
    createdAt: string;
  }>;
  strengths: Array<{ name: string; count: number }>;
  improvements: Array<{ name: string; count: number }>;
}

const ratingLabels: Record<string, string> = {
  very_bad: "Çok Kötü",
  bad: "Kötü",
  average: "Orta",
  good: "İyi",
  successful: "Başarılı",
  excellent: "Mükemmel",
};

const ratingColors: Record<string, string> = {
  very_bad: "bg-red-500",
  bad: "bg-orange-500",
  average: "bg-yellow-500",
  good: "bg-lime-500",
  successful: "bg-green-500",
  excellent: "bg-emerald-500",
};

const categoryLabels: Record<string, string> = {
  communication: "İletişim",
  punctuality: "Dakiklik",
  teamwork: "Takım Çalışması",
  customerService: "Müşteri Memnuniyeti",
  technicalSkills: "Teknik Beceri",
  initiative: "İnisiyatif",
  appearance: "Görünüm",
  stressManagement: "Stres Yönetimi",
};

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const staffId = params.staffId as string;

  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [staffInfo, setStaffInfo] = useState<{
    fullName: string;
    avatar?: string;
    position?: string;
    color?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Performans analizi
      const analysisRes = await leaderApi.getStaffPerformanceAnalysis(staffId);
      setAnalysis(analysisRes.data);

      // Staff bilgisi dashboard'dan al
      const dashboardRes = await leaderApi.getDashboard();
      let foundStaff = null;
      dashboardRes.data.teams?.forEach(
        (team: {
          members?: Array<{
            id: string;
            fullName: string;
            avatar?: string;
            position?: string;
            color?: string;
          }>;
        }) => {
          const member = team.members?.find((m) => m.id === staffId);
          if (member) foundStaff = member;
        }
      );
      setStaffInfo(foundStaff);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [staffId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <Skeleton className="h-32 bg-slate-700 rounded-lg" />
          <Skeleton className="h-64 bg-slate-700 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  const TrendIcon =
    analysis?.trend === "improving"
      ? TrendingUp
      : analysis?.trend === "declining"
      ? TrendingDown
      : Minus;

  const trendColor =
    analysis?.trend === "improving"
      ? "text-green-400"
      : analysis?.trend === "declining"
      ? "text-red-400"
      : "text-slate-400";

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/leader/team")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <PageHeader
            title={staffInfo?.fullName || "Personel Detayı"}
            description="Performans analizi ve değerlendirme geçmişi"
            icon={<User className="w-6 h-6 text-cyan-400" />}
          />
        </div>

        {/* Profil Kartı */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20 border-2 border-slate-600">
                {staffInfo?.avatar && (
                  <AvatarImage src={`${API_BASE}${staffInfo.avatar}`} />
                )}
                <AvatarFallback
                  style={{ backgroundColor: staffInfo?.color || "#3b82f6" }}
                  className="text-white text-2xl"
                >
                  {staffInfo?.fullName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">
                  {staffInfo?.fullName}
                </h2>
                <p className="text-slate-400 capitalize">
                  {staffInfo?.position || "Personel"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">
                  {analysis?.averageScore || "--"}
                </div>
                <p className="text-sm text-slate-400">Ortalama Puan</p>
                {analysis?.averageRating && (
                  <Badge
                    className={`mt-2 ${ratingColors[analysis.averageRating]}`}
                  >
                    {ratingLabels[analysis.averageRating]}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {analysis?.totalReviews || 0}
                </div>
                <div className="text-xs text-slate-400">Değerlendirme</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <TrendIcon className={`w-5 h-5 ${trendColor}`} />
              </div>
              <div>
                <div className="text-lg font-bold text-white capitalize">
                  {analysis?.trend === "improving"
                    ? "Yükseliyor"
                    : analysis?.trend === "declining"
                    ? "Düşüyor"
                    : "Stabil"}
                </div>
                <div className="text-xs text-slate-400">Trend</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kategori Ortalamaları */}
        {analysis?.categoryAverages &&
          Object.keys(analysis.categoryAverages).length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Kategori Ortalamaları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysis.categoryAverages).map(
                    ([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">
                            {categoryLabels[key] || key}
                          </span>
                          <span className="text-white font-medium">
                            {value}/5
                          </span>
                        </div>
                        <Progress value={(value / 5) * 100} className="h-2" />
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Güçlü Yönler ve Gelişim Alanları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Güçlü Yönler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis?.strengths && analysis.strengths.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.strengths.map((s) => (
                    <Badge
                      key={s.name}
                      className="bg-green-500/20 text-green-400"
                    >
                      {s.name} ({s.count})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Henüz veri yok</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                Gelişim Alanları
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis?.improvements && analysis.improvements.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.improvements.map((i) => (
                    <Badge
                      key={i.name}
                      className="bg-amber-500/20 text-amber-400"
                    >
                      {i.name} ({i.count})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Henüz veri yok</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Son Değerlendirmeler */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Son Değerlendirmeler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis?.recentReviews && analysis.recentReviews.length > 0 ? (
              <div className="space-y-3">
                {analysis.recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {review.eventName || "Etkinlik"}
                      </p>
                      <p className="text-sm text-slate-400">
                        {review.eventDate
                          ? new Date(review.eventDate).toLocaleDateString(
                              "tr-TR"
                            )
                          : new Date(review.createdAt).toLocaleDateString(
                              "tr-TR"
                            )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">
                        {review.score}
                      </p>
                      <Badge
                        className={
                          ratingColors[review.rating] || "bg-slate-500"
                        }
                      >
                        {ratingLabels[review.rating] || review.rating}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-10 h-10 text-slate-500 mb-3" />
                <p className="text-slate-400">Henüz değerlendirme yapılmamış</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
