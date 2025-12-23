"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  Calendar,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  User,
  X,
  Target,
  Lightbulb,
  MessageSquare,
  Smile,
  Wrench,
  Zap,
  Shirt,
  Brain,
  Award,
  Cloud,
  CloudOff,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { leaderApi, API_BASE } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface CategoryScores {
  communication: number;
  punctuality: number;
  teamwork: number;
  customerService: number;
  technicalSkills: number;
  initiative: number;
  appearance: number;
  stressManagement: number;
}

interface TeamMember {
  id: string;
  fullName: string;
  avatar?: string;
  color?: string;
  position?: string;
  existingReview?: {
    id: string;
    score: number;
    rating: string;
    isCompleted: boolean;
    categoryScores?: CategoryScores;
    strengths?: string[];
    improvements?: string[];
    comment?: string;
    privateNotes?: string;
    nextEventNotes?: string;
  } | null;
}

interface EventWithMembers {
  id: string;
  name: string;
  date: string;
  status: string;
  members: TeamMember[];
  reviewedCount: number;
  totalMembers: number;
  reviewEnabled?: boolean;
}

interface ReviewData {
  staffId: string;
  categoryScores: CategoryScores;
  strengths: string[];
  improvements: string[];
  comment: string;
  privateNotes: string;
  nextEventNotes: string;
  isCompleted: boolean;
}

const RATING_COLORS: Record<string, string> = {
  very_bad: "bg-red-500",
  bad: "bg-orange-500",
  average: "bg-yellow-500",
  good: "bg-lime-500",
  successful: "bg-green-500",
  excellent: "bg-emerald-500",
};

const RATING_LABELS: Record<string, string> = {
  very_bad: "Çok Kötü",
  bad: "Kötü",
  average: "İdare Eder",
  good: "İyi",
  successful: "Başarılı",
  excellent: "Çok İyi",
};

const EVALUATION_CATEGORIES = [
  { key: "communication", label: "İletişim", icon: MessageSquare, weight: 15 },
  { key: "punctuality", label: "Dakiklik", icon: Clock, weight: 15 },
  { key: "teamwork", label: "Takım Çalışması", icon: Users, weight: 15 },
  {
    key: "customerService",
    label: "Müşteri Memnuniyeti",
    icon: Smile,
    weight: 20,
  },
  { key: "technicalSkills", label: "Teknik Beceri", icon: Wrench, weight: 10 },
  { key: "initiative", label: "İnisiyatif", icon: Zap, weight: 10 },
  { key: "appearance", label: "Görünüm", icon: Shirt, weight: 5 },
  { key: "stressManagement", label: "Stres Yönetimi", icon: Brain, weight: 10 },
];

const PRESET_STRENGTHS = [
  "Mükemmel müşteri ilişkileri",
  "Hızlı ve etkili servis",
  "Takım oyuncusu",
  "Problem çözme yeteneği",
  "Pozitif tutum",
  "Detaylara dikkat",
  "Stres altında sakin",
  "İnisiyatif alıyor",
  "Güvenilir ve dakik",
  "Öğrenmeye açık",
];
const PRESET_IMPROVEMENTS = [
  "Zaman yönetimi",
  "İletişim becerileri",
  "Teknik bilgi",
  "Müşteri odaklılık",
  "Takım çalışması",
  "Stres yönetimi",
  "Dikkat ve özen",
  "Hız ve verimlilik",
  "Profesyonel görünüm",
  "Problem çözme",
];

const PERFORMANCE_LEVELS = [
  { value: 1, label: "Yetersiz", color: "bg-red-500" },
  { value: 2, label: "Gelişmeli", color: "bg-orange-500" },
  { value: 3, label: "Orta", color: "bg-yellow-500" },
  { value: 4, label: "İyi", color: "bg-lime-500" },
  { value: 5, label: "Mükemmel", color: "bg-green-500" },
];

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

const emptyCategoryScores: CategoryScores = {
  communication: 0,
  punctuality: 0,
  teamwork: 0,
  customerService: 0,
  technicalSkills: 0,
  initiative: 0,
  appearance: 0,
  stressManagement: 0,
};

function getRatingFromScore(score: number) {
  for (let i = PERFORMANCE_RATINGS.length - 1; i >= 0; i--) {
    if (score >= PERFORMANCE_RATINGS[i].minScore) return PERFORMANCE_RATINGS[i];
  }
  return PERFORMANCE_RATINGS[0];
}

function calculateOverallScore(categoryScores: CategoryScores): number {
  let totalScore = 0,
    totalWeight = 0;
  EVALUATION_CATEGORIES.forEach((cat) => {
    const score = categoryScores[cat.key as keyof CategoryScores];
    if (score !== undefined && score > 0) {
      totalScore += (score / 5) * cat.weight;
      totalWeight += cat.weight;
    }
  });
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

function hasAnyRating(categoryScores: CategoryScores): boolean {
  return Object.values(categoryScores).some((v) => v > 0);
}

// Star Rating Component
function StarRating({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "transition-transform focus:outline-none",
            disabled ? "cursor-not-allowed opacity-50" : "hover:scale-110"
          )}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => !disabled && onChange(star)}
        >
          <Star
            className={cn(
              "w-5 h-5 transition-colors",
              (hoverValue || value) >= star
                ? "fill-amber-400 text-amber-400"
                : "text-slate-500"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// Category Card Component
function CategoryCard({
  category,
  value,
  onChange,
  disabled = false,
}: {
  category: (typeof EVALUATION_CATEGORIES)[0];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const Icon = category.icon;
  const level = PERFORMANCE_LEVELS.find((l) => l.value === value);
  return (
    <div
      className={cn(
        "p-3 bg-slate-700/50 rounded-lg border border-slate-600 transition-colors",
        !disabled && "hover:border-slate-500"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-slate-600 rounded-lg shrink-0">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-white truncate">
            {category.label}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarRating value={value} onChange={onChange} disabled={disabled} />
          {value > 0 && level && (
            <Badge className={cn("text-[10px]", level.color)}>
              {level.label}
            </Badge>
          )}
          {value === 0 && (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              -
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Tag Selector Component
function TagSelector({
  options,
  selected,
  onChange,
  label,
  color = "cyan",
  disabled = false,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  color?: "cyan" | "amber";
  disabled?: boolean;
}) {
  const colorClasses = {
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  };
  const toggleTag = (tag: string) => {
    if (disabled) return;
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
    );
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => toggleTag(option)}
            className={cn(
              "px-2 py-1 text-xs rounded-full border transition-all",
              disabled && "cursor-not-allowed opacity-50",
              selected.includes(option)
                ? colorClasses[color]
                : "bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Auto Save Indicator
function AutoSaveIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  const config = {
    idle: { icon: Cloud, text: "Hazır", color: "text-slate-400" },
    saving: { icon: Loader2, text: "Kaydediliyor...", color: "text-amber-400" },
    saved: { icon: CheckCircle2, text: "Kaydedildi", color: "text-green-400" },
    error: { icon: CloudOff, text: "Hata", color: "text-red-400" },
  }[status];
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center gap-2 text-sm", config.color)}>
      <Icon className={cn("w-4 h-4", status === "saving" && "animate-spin")} />
      <span>{config.text}</span>
    </div>
  );
}

// Review Modal Component
function ReviewModal({
  member,
  eventId,
  onClose,
  canReview,
  onReviewUpdated,
}: {
  member: TeamMember;
  eventId: string;
  onClose: () => void;
  canReview: boolean;
  onReviewUpdated: () => void;
}) {
  const [review, setReview] = useState<ReviewData>({
    staffId: member.id,
    categoryScores: member.existingReview?.categoryScores || {
      ...emptyCategoryScores,
    },
    strengths: member.existingReview?.strengths || [],
    improvements: member.existingReview?.improvements || [],
    comment: member.existingReview?.comment || "",
    privateNotes: member.existingReview?.privateNotes || "",
    nextEventNotes: member.existingReview?.nextEventNotes || "",
    isCompleted: member.existingReview?.isCompleted || false,
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Her review değişikliğinde score ve rating'i yeniden hesapla
  const score = useMemo(
    () => calculateOverallScore(review.categoryScores),
    [review.categoryScores]
  );
  const rating = useMemo(() => getRatingFromScore(score), [score]);
  const isReviewed = useMemo(
    () => hasAnyRating(review.categoryScores),
    [review.categoryScores]
  );

  const saveReview = useCallback(
    async (data: ReviewData) => {
      try {
        setAutoSaveStatus("saving");
        await leaderApi.autoSaveReview(eventId, member.id, {
          categoryScores: data.categoryScores,
          strengths: data.strengths,
          improvements: data.improvements,
          comment: data.comment,
          privateNotes: data.privateNotes,
          nextEventNotes: data.nextEventNotes,
        });
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Kaydetme hatası:", error);
        setAutoSaveStatus("error");
      }
    },
    [eventId, member.id]
  );

  const handleClose = () => {
    onReviewUpdated(); // Modal kapanırken listeyi güncelle
    onClose();
  };

  const updateReview = (field: keyof ReviewData, value: unknown) => {
    const updated = { ...review, [field]: value };
    setReview(updated);
    if (canReview) saveReview(updated);
  };

  const updateCategoryScore = (
    category: keyof CategoryScores,
    value: number
  ) => {
    const updated = {
      ...review,
      categoryScores: { ...review.categoryScores, [category]: value },
    };
    setReview(updated);
    if (canReview) saveReview(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 border-2 border-slate-600">
              {member.avatar && (
                <AvatarImage src={`${API_BASE}${member.avatar}`} />
              )}
              <AvatarFallback
                style={{ backgroundColor: member.color || "#475569" }}
              >
                {member.fullName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {member.fullName}
              </h2>
              <p className="text-sm text-slate-400 capitalize">
                {member.position || "Personel"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AutoSaveIndicator status={autoSaveStatus} />
            <div className="text-right">
              {isReviewed ? (
                <>
                  <p className="text-2xl font-bold text-white">{score}</p>
                  <Badge className={cn("text-xs", rating.color)}>
                    {rating.label}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline" className="text-slate-500">
                  Değerlendirilmedi
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {/* Kategori Değerlendirmeleri */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              Kategori Bazlı Değerlendirme
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EVALUATION_CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.key}
                  category={cat}
                  disabled={!canReview}
                  value={
                    review.categoryScores[cat.key as keyof CategoryScores] || 0
                  }
                  onChange={(value) =>
                    updateCategoryScore(cat.key as keyof CategoryScores, value)
                  }
                />
              ))}
            </div>
          </div>

          {/* Performans Özeti */}
          {isReviewed && (
            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-3 rounded-xl", rating.color)}>
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">{score}</p>
                    <p className="text-sm text-slate-400">Genel Puan</p>
                  </div>
                </div>
                <Badge className={cn("text-sm px-3 py-1", rating.color)}>
                  {rating.label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EVALUATION_CATEGORIES.map((cat) => {
                  const catScore =
                    review.categoryScores[cat.key as keyof CategoryScores] || 0;
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 truncate">
                          {cat.label}
                        </span>
                        <span className="text-xs text-white">
                          {catScore > 0 ? `${catScore}/5` : "-"}
                        </span>
                      </div>
                      <Progress
                        value={catScore > 0 ? (catScore / 5) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Güçlü Yönler & Gelişim Alanları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Güçlü Yönler
              </h4>
              <TagSelector
                options={PRESET_STRENGTHS}
                selected={review.strengths}
                disabled={!canReview}
                onChange={(selected) => updateReview("strengths", selected)}
                label="Personelin öne çıkan özellikleri"
                color="cyan"
              />
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Gelişim Alanları
              </h4>
              <TagSelector
                options={PRESET_IMPROVEMENTS}
                selected={review.improvements}
                disabled={!canReview}
                onChange={(selected) => updateReview("improvements", selected)}
                label="Geliştirilmesi gereken alanlar"
                color="amber"
              />
            </div>
          </div>

          {/* Notlar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">
                Genel Değerlendirme
              </label>
              <Textarea
                placeholder="Personel hakkında genel değerlendirmenizi yazın..."
                disabled={!canReview}
                value={review.comment}
                onChange={(e) => updateReview("comment", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none h-24"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">
                Sonraki Etkinlik İçin Notlar
              </label>
              <Textarea
                placeholder="Bir sonraki etkinlikte dikkat edilecek konular..."
                disabled={!canReview}
                value={review.nextEventNotes}
                onChange={(e) => updateReview("nextEventNotes", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none h-24"
              />
            </div>
          </div>

          {/* Özel Notlar */}
          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm text-slate-400 flex items-center gap-1 cursor-help">
                    Özel Notlar
                    <AlertCircle className="w-3 h-3" />
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bu notlar sadece size görünür</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Textarea
              placeholder="Sadece sizin görebileceğiniz özel notlar..."
              disabled={!canReview}
              value={review.privateNotes}
              onChange={(e) => updateReview("privateNotes", e.target.value)}
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 resize-none h-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderReviewsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<EventWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<{
    member: TeamMember;
    eventId: string;
    canReview: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dashboardRes = await leaderApi.getDashboard();

      const allEvents = [
        ...(dashboardRes.data.assignedEvents || []),
        ...(dashboardRes.data.pastEventsForReview || []),
      ];

      const uniqueEvents = allEvents.reduce(
        (acc: Record<string, unknown>[], event: Record<string, unknown>) => {
          if (!acc.find((e) => e.id === event.id)) acc.push(event);
          return acc;
        },
        []
      );

      const eventsWithMembers = await Promise.all(
        uniqueEvents.map(async (event: Record<string, unknown>) => {
          try {
            const detailRes = await leaderApi.getEventDetails(
              event.id as string
            );
            const members = detailRes.data.members || [];

            // Değerlendirme yapılmış mı kontrol et (categoryScores'da en az bir değer > 0)
            const reviewedCount = members.filter((m: TeamMember) => {
              if (!m.existingReview?.categoryScores) return false;
              return Object.values(m.existingReview.categoryScores).some(
                (v) => v > 0
              );
            }).length;

            // Review permission kontrolü
            let reviewEnabled = true;
            try {
              const permRes = await leaderApi.checkReviewPermission(
                event.id as string
              );
              reviewEnabled = permRes.data.reviewEnabled;
            } catch {
              reviewEnabled = true;
            }

            return {
              id: event.id as string,
              name: event.name as string,
              date: event.date as string,
              status: event.status as string,
              members,
              reviewedCount,
              totalMembers: members.length,
              reviewEnabled,
            };
          } catch {
            return {
              id: event.id as string,
              name: event.name as string,
              date: event.date as string,
              status: event.status as string,
              members: [],
              reviewedCount: 0,
              totalMembers: 0,
              reviewEnabled: false,
            };
          }
        })
      );

      eventsWithMembers.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEvents(eventsWithMembers);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role !== "leader") {
      router.push("/");
      return;
    }
    loadData();
  }, [user, loadData, router]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) newSet.delete(eventId);
      else newSet.add(eventId);
      return newSet;
    });
  };

  const filteredEvents = events.filter((event) =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingEvents = filteredEvents.filter(
    (e) => e.reviewedCount < e.totalMembers && e.totalMembers > 0
  );
  const completedEvents = filteredEvents.filter(
    (e) => e.reviewedCount === e.totalMembers && e.totalMembers > 0
  );

  const totalMembers = events.reduce((sum, e) => sum + e.totalMembers, 0);
  const totalReviewed = events.reduce((sum, e) => sum + e.reviewedCount, 0);
  const completionRate =
    totalMembers > 0 ? Math.round((totalReviewed / totalMembers) * 100) : 0;

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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
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
          title="Değerlendirmeler"
          description="Ekip üyelerinin performans değerlendirmelerini yönetin"
          icon={<Star className="w-6 h-6 text-amber-400" />}
        />

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/30 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {pendingEvents.length}
                  </p>
                  <p className="text-xs text-slate-400">Bekleyen Etkinlik</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/30 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {completedEvents.length}
                  </p>
                  <p className="text-xs text-slate-400">Tamamlanan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/30 rounded-lg">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {totalReviewed}/{totalMembers}
                  </p>
                  <p className="text-xs text-slate-400">Değerlendirilen</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    %{completionRate}
                  </p>
                  <p className="text-xs text-slate-400">Tamamlanma</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Arama */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Etkinlik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-amber-500/20"
            >
              <Clock className="w-4 h-4 mr-2" />
              Bekleyen ({pendingEvents.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-green-500/20"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Tamamlanan ({completedEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-slate-400">Bekleyen değerlendirme yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isExpanded={expandedEvents.has(event.id)}
                    onToggle={() => toggleExpand(event.id)}
                    onMemberClick={(member) =>
                      setSelectedMember({
                        member,
                        eventId: event.id,
                        canReview: event.reviewEnabled ?? true,
                      })
                    }
                    isPending
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400">
                  Henüz tamamlanan değerlendirme yok
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isExpanded={expandedEvents.has(event.id)}
                    onToggle={() => toggleExpand(event.id)}
                    onMemberClick={(member) =>
                      setSelectedMember({
                        member,
                        eventId: event.id,
                        canReview: event.reviewEnabled ?? true,
                      })
                    }
                    isPending={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Modal */}
      {selectedMember && (
        <ReviewModal
          member={selectedMember.member}
          eventId={selectedMember.eventId}
          onClose={() => setSelectedMember(null)}
          canReview={selectedMember.canReview}
          onReviewUpdated={loadData}
        />
      )}
    </PageContainer>
  );
}

// Event Card Component
function EventCard({
  event,
  isExpanded,
  onToggle,
  onMemberClick,
  isPending,
}: {
  event: EventWithMembers;
  isExpanded: boolean;
  onToggle: () => void;
  onMemberClick: (member: TeamMember) => void;
  isPending: boolean;
}) {
  const progressPercent =
    event.totalMembers > 0
      ? Math.round((event.reviewedCount / event.totalMembers) * 100)
      : 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card
        className={cn(
          "bg-slate-800/50 transition-all overflow-hidden",
          isPending
            ? "border-amber-700/50 hover:border-amber-600"
            : "border-slate-700 hover:border-slate-600"
        )}
      >
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-3 rounded-lg",
                    isPending ? "bg-amber-500/20" : "bg-green-500/20"
                  )}
                >
                  {isPending ? (
                    <Star className="w-6 h-6 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{event.name}</h3>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(event.date).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3 min-w-[150px]">
                  <Progress value={progressPercent} className="h-2 flex-1" />
                  <span className="text-sm text-slate-400 w-16 text-right">
                    {event.reviewedCount}/{event.totalMembers}
                  </span>
                </div>
                <Badge
                  className={cn(
                    isPending
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-green-500/20 text-green-400"
                  )}
                >
                  {isPending ? "Bekliyor" : "Tamamlandı"}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-slate-700 p-4 bg-slate-900/50">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-cyan-400" />
              Ekip Üyeleri ({event.totalMembers})
            </h4>

            {event.members.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Ekip üyesi bulunamadı
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {event.members.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onClick={() => onMemberClick(member)}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Member Card Component
function MemberCard({
  member,
  onClick,
}: {
  member: TeamMember;
  onClick: () => void;
}) {
  // Değerlendirme yapılmış mı kontrol et (categoryScores'da en az bir değer > 0)
  const hasReview = member.existingReview?.categoryScores
    ? Object.values(member.existingReview.categoryScores).some((v) => v > 0)
    : false;
  const rating = member.existingReview?.rating;
  const score = member.existingReview?.score;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        hasReview
          ? "bg-slate-800/50 border-slate-600 hover:border-slate-500"
          : "bg-slate-800/30 border-slate-700 border-dashed hover:border-amber-600/50"
      )}
    >
      <Avatar className="w-10 h-10 border-2 border-slate-600">
        {member.avatar && <AvatarImage src={`${API_BASE}${member.avatar}`} />}
        <AvatarFallback
          className="text-sm"
          style={{ backgroundColor: member.color || "#475569" }}
        >
          {member.fullName.charAt(0)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {member.fullName}
        </p>
        <p className="text-xs text-slate-400 capitalize">
          {member.position || "Personel"}
        </p>
      </div>

      {hasReview ? (
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-bold text-white">{score}</span>
          {rating && (
            <Badge
              className={cn("text-[10px] px-1.5", RATING_COLORS[rating] || "")}
            >
              {RATING_LABELS[rating] || rating}
            </Badge>
          )}
        </div>
      ) : (
        <Badge variant="outline" className="text-slate-500 border-slate-600">
          <User className="w-3 h-3 mr-1" />
          Bekliyor
        </Badge>
      )}
    </div>
  );
}
