"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Star,
  ArrowLeft,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { leaderApi, API_BASE } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/ui/toast-notification";

const PERFORMANCE_RATINGS = [
  { value: "very_bad", label: "Çok Kötü", color: "bg-red-600", minScore: 0 },
  { value: "bad", label: "Kötü", color: "bg-orange-600", minScore: 20 },
  {
    value: "average",
    label: "İdare Eder",
    color: "bg-yellow-600",
    minScore: 40,
  },
  { value: "good", label: "İyi", color: "bg-lime-600", minScore: 60 },
  {
    value: "successful",
    label: "Başarılı",
    color: "bg-green-600",
    minScore: 80,
  },
  {
    value: "excellent",
    label: "Çok İyi",
    color: "bg-emerald-600",
    minScore: 90,
  },
];

function getRatingFromScore(score: number) {
  for (let i = PERFORMANCE_RATINGS.length - 1; i >= 0; i--) {
    if (score >= PERFORMANCE_RATINGS[i].minScore) {
      return PERFORMANCE_RATINGS[i];
    }
  }
  return PERFORMANCE_RATINGS[0];
}

interface TeamMember {
  id: string;
  fullName: string;
  avatar?: string;
  position?: string;
  existingReview: {
    score: number;
    rating: string;
    comment?: string;
  } | null;
}

interface ReviewData {
  staffId: string;
  score: number;
  rating: string;
  comment: string;
}

export default function LeaderEventReviewPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { user } = useAuthStore();
  const eventId = params.eventId as string;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [reviews, setReviews] = useState<Map<string, ReviewData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventName, setEventName] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, eventRes] = await Promise.all([
        leaderApi.getTeamMembersForReview(eventId),
        leaderApi.getEventDetails(eventId),
      ]);

      setMembers(membersRes.data);
      setEventName(eventRes.data.event?.name || "Etkinlik");

      // Mevcut değerlendirmeleri yükle
      const reviewMap = new Map<string, ReviewData>();
      membersRes.data.forEach((member: TeamMember) => {
        if (member.existingReview) {
          reviewMap.set(member.id, {
            staffId: member.id,
            score: member.existingReview.score,
            rating: member.existingReview.rating,
            comment: member.existingReview.comment || "",
          });
        } else {
          reviewMap.set(member.id, {
            staffId: member.id,
            score: 70,
            rating: "good",
            comment: "",
          });
        }
      });
      setReviews(reviewMap);
    } catch (error: any) {
      console.error("Veriler yüklenemedi:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user?.role !== "leader") {
      router.push("/");
      return;
    }
    loadData();
  }, [user, loadData, router]);

  const updateReview = (
    staffId: string,
    field: keyof ReviewData,
    value: any
  ) => {
    setReviews((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(staffId) || {
        staffId,
        score: 70,
        rating: "good",
        comment: "",
      };

      if (field === "score") {
        const rating = getRatingFromScore(value);
        newMap.set(staffId, { ...current, score: value, rating: rating.value });
      } else {
        newMap.set(staffId, { ...current, [field]: value });
      }

      return newMap;
    });
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const reviewsArray = Array.from(reviews.values());
      await leaderApi.createBulkReviews(eventId, reviewsArray);
      toast.success("Değerlendirmeler kaydedildi");
      router.push("/leader");
    } catch (error: any) {
      console.error("Kaydetme hatası:", error);
      toast.error(error.response?.data?.message || "Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (members.length === 0) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
          <p className="text-slate-400">
            Değerlendirilecek ekip üyesi bulunamadı
          </p>
          <Button onClick={() => router.push("/leader")} className="mt-4">
            Geri Dön
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/leader/events/${eventId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <PageHeader
            title="Performans Değerlendirmesi"
            description={eventName}
            icon={<Star className="w-6 h-6 text-amber-400" />}
          />
        </div>

        {/* Değerlendirme Kartları */}
        <div className="space-y-4">
          {members.map((member) => {
            const review = reviews.get(member.id);
            const rating = review
              ? getRatingFromScore(review.score)
              : PERFORMANCE_RATINGS[3];

            return (
              <Card
                key={member.id}
                className="bg-slate-800/50 border-slate-700"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar ve İsim */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <Avatar className="w-12 h-12">
                        {member.avatar && (
                          <AvatarImage src={`${API_BASE}${member.avatar}`} />
                        )}
                        <AvatarFallback className="bg-slate-600">
                          {member.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">
                          {member.fullName}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">
                          {member.position || "Personel"}
                        </p>
                        {member.existingReview && (
                          <Badge className="mt-1 text-[10px] bg-green-500/20 text-green-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Değerlendirildi
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Puan ve Rating */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400">Puan</span>
                            <span className="text-2xl font-bold text-white">
                              {review?.score || 70}
                            </span>
                          </div>
                          <Slider
                            value={[review?.score || 70]}
                            onValueChange={(value: number[]) =>
                              updateReview(member.id, "score", value[0])
                            }
                            max={100}
                            step={5}
                            className="w-full"
                          />
                        </div>
                        <Badge
                          className={`${rating.color} text-white px-3 py-1 min-w-[100px] justify-center`}
                        >
                          {rating.label}
                        </Badge>
                      </div>

                      {/* Hızlı Rating Butonları */}
                      <div className="flex flex-wrap gap-2">
                        {PERFORMANCE_RATINGS.map((r) => (
                          <Button
                            key={r.value}
                            size="sm"
                            variant={
                              review?.rating === r.value ? "default" : "outline"
                            }
                            className={
                              review?.rating === r.value
                                ? `${r.color} text-white border-0`
                                : "border-slate-600 text-slate-400 hover:text-white"
                            }
                            onClick={() => {
                              updateReview(member.id, "score", r.minScore + 5);
                            }}
                          >
                            {r.label}
                          </Button>
                        ))}
                      </div>

                      {/* Yorum */}
                      <Textarea
                        placeholder="Yorum ekle (opsiyonel)..."
                        value={review?.comment || ""}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          updateReview(member.id, "comment", e.target.value)
                        }
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none h-16"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Kaydet Butonu */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            size="lg"
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 shadow-lg"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Tüm Değerlendirmeleri Kaydet
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
