"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Star,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
} from "lucide-react";
import { staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvatarUrl } from "../utils";
import type { Personnel, StaffReview } from "../types";

// Puan renkleri
const getScoreColor = (score: number) => {
  if (score >= 4.5) return "text-green-400";
  if (score >= 3.5) return "text-blue-400";
  if (score >= 2.5) return "text-yellow-400";
  return "text-red-400";
};

const getScoreBg = (score: number) => {
  if (score >= 4.5) return "bg-green-500/20 border-green-500/30";
  if (score >= 3.5) return "bg-blue-500/20 border-blue-500/30";
  if (score >= 2.5) return "bg-yellow-500/20 border-yellow-500/30";
  return "bg-red-500/20 border-red-500/30";
};

interface PersonnelWithReviews extends Personnel {
  reviews: StaffReview[];
  averageScore: number;
  reviewCount: number;
  trend: "up" | "down" | "stable";
}

interface ReviewsModuleProps {
  personnelStats: { total: number } | null;
}

export function ReviewsModule({ personnelStats }: ReviewsModuleProps) {
  const [personnel, setPersonnel] = useState<PersonnelWithReviews[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score-desc");
  const [expandedPersonnel, setExpandedPersonnel] = useState<Set<string>>(
    new Set()
  );
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReview, setSelectedReview] = useState<StaffReview | null>(
    null
  );

  // Verileri yükle
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const personnelRes = await staffApi.getPersonnel();

      // Reviews API'si yoksa boş array kullan
      let reviewsList: StaffReview[] = [];
      try {
        // @ts-ignore - API'de henüz tanımlı olmayabilir
        const reviewsRes = await (staffApi as any).getReviews?.();
        reviewsList = reviewsRes?.data || [];
      } catch {
        reviewsList = [];
      }

      const personnelList = personnelRes.data || [];

      // Personellere değerlendirmeleri ekle
      const personnelWithReviews: PersonnelWithReviews[] = personnelList.map(
        (p: Personnel) => {
          const personReviews = reviewsList.filter(
            (r: StaffReview) => r.staffId === p.id
          );
          const avgScore =
            personReviews.length > 0
              ? personReviews.reduce(
                  (sum: number, r: StaffReview) => sum + r.overallScore,
                  0
                ) / personReviews.length
              : 0;

          // Trend hesapla (son 3 değerlendirme)
          let trend: "up" | "down" | "stable" = "stable";
          if (personReviews.length >= 2) {
            const sorted = [...personReviews].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
            const recent = sorted.slice(0, 3);
            const recentAvg =
              recent.reduce((sum, r) => sum + r.overallScore, 0) /
              recent.length;
            const olderAvg =
              sorted.length > 3
                ? sorted.slice(3).reduce((sum, r) => sum + r.overallScore, 0) /
                  (sorted.length - 3)
                : avgScore;

            if (recentAvg > olderAvg + 0.3) trend = "up";
            else if (recentAvg < olderAvg - 0.3) trend = "down";
          }

          return {
            ...p,
            reviews: personReviews,
            averageScore: avgScore,
            reviewCount: personReviews.length,
            trend,
          };
        }
      );

      setPersonnel(personnelWithReviews);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Departmanlar
  const departments = useMemo(() => {
    const depts = new Set(
      personnel.map((p) => p.department).filter((d): d is string => !!d)
    );
    return Array.from(depts).sort();
  }, [personnel]);

  // Filtrelenmiş ve sıralanmış personel
  const filteredPersonnel = useMemo(() => {
    let result = [...personnel];

    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.fullName.toLowerCase().includes(query) ||
          p.sicilNo?.toLowerCase().includes(query) ||
          p.position?.toLowerCase().includes(query)
      );
    }

    // Departman filtresi
    if (departmentFilter !== "all") {
      result = result.filter((p) => p.department === departmentFilter);
    }

    // Sıralama
    switch (sortBy) {
      case "score-desc":
        result.sort((a, b) => b.averageScore - a.averageScore);
        break;
      case "score-asc":
        result.sort((a, b) => a.averageScore - b.averageScore);
        break;
      case "reviews-desc":
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case "name-asc":
        result.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }

    return result;
  }, [personnel, searchQuery, departmentFilter, sortBy]);

  // İstatistikler
  const stats = useMemo(() => {
    const withReviews = personnel.filter((p) => p.reviewCount > 0);
    const totalReviews = personnel.reduce((sum, p) => sum + p.reviewCount, 0);
    const avgScore =
      withReviews.length > 0
        ? withReviews.reduce((sum, p) => sum + p.averageScore, 0) /
          withReviews.length
        : 0;

    return {
      totalPersonnel: personnel.length,
      withReviews: withReviews.length,
      totalReviews,
      avgScore,
    };
  }, [personnel]);

  const togglePersonnel = (id: string) => {
    setExpandedPersonnel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderStars = (score: number, size: "sm" | "md" = "sm") => {
    const sizeClass = size === "sm" ? "w-3 h-3" : "w-4 h-4";
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${sizeClass} ${
              i <= Math.round(score)
                ? "text-yellow-400 fill-yellow-400"
                : "text-slate-600"
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64 bg-slate-700" />
          <Skeleton className="h-10 w-32 bg-slate-700" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 bg-slate-700 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full bg-slate-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Toplam Personel</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalPersonnel}
                </p>
              </div>
              <User className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Değerlendirilen</p>
                <p className="text-2xl font-bold text-white">
                  {stats.withReviews}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Toplam Değerlendirme</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalReviews}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Ortalama Puan</p>
                <p
                  className={`text-2xl font-bold ${getScoreColor(
                    stats.avgScore
                  )}`}
                >
                  {stats.avgScore.toFixed(1)}
                </p>
              </div>
              <div className="flex">{renderStars(stats.avgScore, "md")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Personel ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-slate-600 ${showFilters ? "bg-slate-700" : ""}`}
          >
            <Filter className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            className="border-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <Badge
          variant="outline"
          className="bg-green-500/20 text-green-400 border-green-500/30"
        >
          {filteredPersonnel.length} Personel
        </Badge>
      </div>

      {/* Filtreler */}
      {showFilters && (
        <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Departman:</span>
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Tümü</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Sırala:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="score-desc">
                  Puan (Yüksek → Düşük)
                </SelectItem>
                <SelectItem value="score-asc">Puan (Düşük → Yüksek)</SelectItem>
                <SelectItem value="reviews-desc">
                  Değerlendirme Sayısı
                </SelectItem>
                <SelectItem value="name-asc">İsim (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Personel Listesi */}
      {filteredPersonnel.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <Star className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">
            {searchQuery || departmentFilter !== "all"
              ? "Arama kriterlerine uygun personel bulunamadı"
              : "Henüz değerlendirme yapılmamış"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredPersonnel.map((person) => {
            const isExpanded = expandedPersonnel.has(person.id);

            return (
              <div
                key={person.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
              >
                {/* Personel Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => togglePersonnel(person.id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      className="w-10 h-10 border-2"
                      style={{
                        borderColor:
                          person.averageScore >= 4
                            ? "#22c55e"
                            : person.averageScore >= 3
                            ? "#3b82f6"
                            : "#ef4444",
                      }}
                    >
                      <AvatarImage src={getAvatarUrl(person.avatar)} />
                      <AvatarFallback className="bg-slate-600 text-white">
                        {person.fullName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-white text-sm flex items-center gap-2">
                        {person.fullName}
                        {person.trend === "up" && (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        )}
                        {person.trend === "down" && (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        {person.trend === "stable" &&
                          person.reviewCount > 0 && (
                            <Minus className="w-3 h-3 text-slate-400" />
                          )}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {person.department} • {person.position || "Personel"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {person.reviewCount > 0 ? (
                      <>
                        <div className="flex items-center gap-2">
                          {renderStars(person.averageScore)}
                          <span
                            className={`text-sm font-medium ${getScoreColor(
                              person.averageScore
                            )}`}
                          >
                            {person.averageScore.toFixed(1)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-slate-700/50 border-slate-600"
                        >
                          {person.reviewCount} değerlendirme
                        </Badge>
                      </>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-slate-700/50 border-slate-600 text-slate-500"
                      >
                        Değerlendirme yok
                      </Badge>
                    )}
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Değerlendirme Detayları */}
                {isExpanded && (
                  <div className="border-t border-slate-700 bg-slate-800/50 p-3">
                    {person.reviews.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-4">
                        Bu personel için henüz değerlendirme yapılmamış
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {person.reviews
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() -
                              new Date(a.createdAt).getTime()
                          )
                          .slice(0, 5)
                          .map((review) => (
                            <div
                              key={review.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 cursor-pointer"
                              onClick={() => setSelectedReview(review)}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`px-2 py-1 rounded ${getScoreBg(
                                    review.overallScore
                                  )}`}
                                >
                                  <span
                                    className={`text-sm font-bold ${getScoreColor(
                                      review.overallScore
                                    )}`}
                                  >
                                    {review.overallScore.toFixed(1)}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm text-white">
                                    {review.event?.name || "Etkinlik"}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {formatDate(review.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <Eye className="w-4 h-4 text-slate-400" />
                            </div>
                          ))}
                        {person.reviews.length > 5 && (
                          <p className="text-center text-xs text-slate-500 pt-2">
                            +{person.reviews.length - 5} daha fazla
                            değerlendirme
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Değerlendirme Detay Modal */}
      <Dialog
        open={!!selectedReview}
        onOpenChange={() => setSelectedReview(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle>Değerlendirme Detayı</DialogTitle>
            <p className="text-sm text-slate-400">
              Personel performans değerlendirmesi
            </p>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Etkinlik</p>
                  <p className="text-white">
                    {selectedReview.event?.name || "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Tarih</p>
                  <p className="text-white">
                    {formatDate(selectedReview.createdAt)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Genel Puan", value: selectedReview.overallScore },
                  { label: "Dakiklik", value: selectedReview.punctualityScore },
                  { label: "Tutum", value: selectedReview.attitudeScore },
                  {
                    label: "Takım Çalışması",
                    value: selectedReview.teamworkScore,
                  },
                  {
                    label: "Verimlilik",
                    value: selectedReview.efficiencyScore,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-2 rounded-lg bg-slate-700/50"
                  >
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(item.value)}
                      <span
                        className={`text-sm font-medium ${getScoreColor(
                          item.value
                        )}`}
                      >
                        {item.value?.toFixed(1) || "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedReview.comment && (
                <div className="p-3 rounded-lg bg-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Yorum</p>
                  <p className="text-sm text-white">{selectedReview.comment}</p>
                </div>
              )}

              {selectedReview.reviewer && (
                <div className="text-xs text-slate-500 text-right">
                  Değerlendiren: {selectedReview.reviewer.fullName}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
