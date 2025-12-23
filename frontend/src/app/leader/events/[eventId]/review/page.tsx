"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Star,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Award,
  Target,
  Lightbulb,
  Clock,
  Users,
  Smile,
  Wrench,
  Zap,
  Shirt,
  Brain,
  BarChart3,
  ShieldAlert,
  CloudOff,
  Cloud,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { leaderApi, API_BASE } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/ui/toast-notification";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const EVALUATION_CATEGORIES = [
  {
    key: "communication",
    label: "İletişim Becerileri",
    icon: MessageSquare,
    description: "Müşteri ve ekip ile iletişim kalitesi",
    weight: 15,
  },
  {
    key: "punctuality",
    label: "Dakiklik ve Güvenilirlik",
    icon: Clock,
    description: "Zamanında gelme ve görevleri tamamlama",
    weight: 15,
  },
  {
    key: "teamwork",
    label: "Takım Çalışması",
    icon: Users,
    description: "Ekip içi uyum ve işbirliği",
    weight: 15,
  },
  {
    key: "customerService",
    label: "Müşteri Memnuniyeti",
    icon: Smile,
    description: "Müşteri odaklılık ve hizmet kalitesi",
    weight: 20,
  },
  {
    key: "technicalSkills",
    label: "Teknik Beceriler",
    icon: Wrench,
    description: "İş bilgisi ve uygulama yetkinliği",
    weight: 10,
  },
  {
    key: "initiative",
    label: "İnisiyatif ve Problem Çözme",
    icon: Zap,
    description: "Proaktif davranış ve çözüm üretme",
    weight: 10,
  },
  {
    key: "appearance",
    label: "Kıyafet ve Görünüm",
    icon: Shirt,
    description: "Profesyonel görünüm standartları",
    weight: 5,
  },
  {
    key: "stressManagement",
    label: "Stres Yönetimi",
    icon: Brain,
    description: "Yoğun anlarda sakinlik ve performans",
    weight: 10,
  },
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
    if (score !== undefined && score !== null) {
      totalScore += (score / 5) * cat.weight;
      totalWeight += cat.weight;
    }
  });
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

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
  position?: string;
  existingReview: {
    score: number;
    rating: string;
    comment?: string;
    categoryScores?: CategoryScores;
    strengths?: string[];
    improvements?: string[];
    privateNotes?: string;
    nextEventNotes?: string;
    isCompleted?: boolean;
  } | null;
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

const defaultCategoryScores: CategoryScores = {
  communication: 3,
  punctuality: 3,
  teamwork: 3,
  customerService: 3,
  technicalSkills: 3,
  initiative: 3,
  appearance: 3,
  stressManagement: 3,
};

function StarRating({
  value,
  onChange,
  disabled = false,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const sizeClasses = { sm: "w-5 h-5", md: "w-7 h-7", lg: "w-9 h-9" };
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
              sizeClasses[size],
              "transition-colors",
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-slate-600 rounded-lg shrink-0">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {category.label}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {category.description}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StarRating
            value={value}
            onChange={onChange}
            size="sm"
            disabled={disabled}
          />
          {level && (
            <Badge className={cn("text-[10px]", level.color)}>
              {level.label}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

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
  color?: "cyan" | "amber" | "red";
  disabled?: boolean;
}) {
  const colorClasses = {
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    red: "bg-red-500/20 text-red-400 border-red-500/50",
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

function AutoSaveIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  const config = {
    idle: { icon: Cloud, text: "Hazır", color: "text-slate-400" },
    saving: { icon: Loader2, text: "Kaydediliyor...", color: "text-amber-400" },
    saved: { icon: CheckCircle2, text: "Kaydedildi", color: "text-green-400" },
    error: { icon: CloudOff, text: "Kaydetme hatası", color: "text-red-400" },
  }[status];
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center gap-2 text-sm", config.color)}>
      <Icon className={cn("w-4 h-4", status === "saving" && "animate-spin")} />
      <span>{config.text}</span>
    </div>
  );
}

// Personel Kartı
function StaffCard({
  member,
  review,
  onClick,
}: {
  member: TeamMember;
  review: ReviewData | undefined;
  onClick: () => void;
}) {
  const score = review ? calculateOverallScore(review.categoryScores) : 0;
  const rating = getRatingFromScore(score);
  const isReviewed =
    review && Object.values(review.categoryScores).some((v) => v !== 3);

  return (
    <Card
      className="bg-slate-800/50 border-slate-700 hover:border-slate-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 border-2 border-slate-600">
            {member.avatar && (
              <AvatarImage src={`${API_BASE}${member.avatar}`} />
            )}
            <AvatarFallback className="bg-slate-600 text-lg">
              {member.fullName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">
              {member.fullName}
            </p>
            <p className="text-sm text-slate-400 capitalize">
              {member.position || "Personel"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{score}</p>
            <Badge className={cn("text-xs", rating.color)}>
              {rating.label}
            </Badge>
          </div>
        </div>

        {/* Mini Progress Bars */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {EVALUATION_CATEGORIES.slice(0, 4).map((cat) => {
            const catScore =
              review?.categoryScores[cat.key as keyof CategoryScores] || 3;
            return (
              <div key={cat.key} className="space-y-1">
                <Progress value={(catScore / 5) * 100} className="h-1.5" />
                <p className="text-[10px] text-slate-500 truncate">
                  {cat.label.split(" ")[0]}
                </p>
              </div>
            );
          })}
        </div>

        {/* Status Badge */}
        <div className="mt-3 flex items-center justify-between">
          {isReviewed ? (
            <Badge className="bg-green-500/20 text-green-400 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Değerlendirildi
            </Badge>
          ) : (
            <Badge className="bg-slate-600/50 text-slate-400 text-xs">
              Bekliyor
            </Badge>
          )}
          <span className="text-xs text-slate-500">Detay için tıkla</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Değerlendirme Modal
function ReviewModal({
  member,
  review,
  onClose,
  onUpdateReview,
  onUpdateCategoryScore,
  canReview,
  autoSaveStatus,
}: {
  member: TeamMember;
  review: ReviewData;
  onClose: () => void;
  onUpdateReview: (field: keyof ReviewData, value: unknown) => void;
  onUpdateCategoryScore: (
    category: keyof CategoryScores,
    value: number
  ) => void;
  canReview: boolean;
  autoSaveStatus: "idle" | "saving" | "saved" | "error";
}) {
  const score = calculateOverallScore(review.categoryScores);
  const rating = getRatingFromScore(score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 border-2 border-slate-600">
              {member.avatar && (
                <AvatarImage src={`${API_BASE}${member.avatar}`} />
              )}
              <AvatarFallback className="bg-slate-600">
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
              <p className="text-2xl font-bold text-white">{score}</p>
              <Badge className={cn("text-xs", rating.color)}>
                {rating.label}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
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
                    review.categoryScores[cat.key as keyof CategoryScores] || 3
                  }
                  onChange={(value) =>
                    onUpdateCategoryScore(
                      cat.key as keyof CategoryScores,
                      value
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* Performans Özeti */}
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
                        {cat.label.split(" ")[0]}
                      </span>
                      <span className="text-xs text-white">{catScore}/5</span>
                    </div>
                    <Progress value={(catScore / 5) * 100} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>

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
                onChange={(selected) => onUpdateReview("strengths", selected)}
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
                onChange={(selected) =>
                  onUpdateReview("improvements", selected)
                }
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
                onChange={(e) => onUpdateReview("comment", e.target.value)}
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
                onChange={(e) =>
                  onUpdateReview("nextEventNotes", e.target.value)
                }
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
              onChange={(e) => onUpdateReview("privateNotes", e.target.value)}
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 resize-none h-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
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
  const [eventName, setEventName] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [canReview, setCanReview] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState("");

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<Map<string, ReviewData>>(new Map());

  const autoSave = useCallback(
    async (staffId: string, data: ReviewData) => {
      try {
        setAutoSaveStatus("saving");
        await leaderApi.autoSaveReview(eventId, staffId, {
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
        console.error("Auto-save hatası:", error);
        setAutoSaveStatus("error");
      }
    },
    [eventId]
  );

  const scheduleAutoSave = useCallback(
    (staffId: string, data: ReviewData) => {
      pendingChangesRef.current.set(staffId, data);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const pending = pendingChangesRef.current.get(staffId);
        if (pending) {
          autoSave(staffId, pending);
          pendingChangesRef.current.delete(staffId);
        }
      }, 1500);
    },
    [autoSave]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      try {
        const permRes = await leaderApi.checkReviewPermission(eventId);
        setCanReview(permRes.data.reviewEnabled);
        if (!permRes.data.reviewEnabled)
          setPermissionMessage(
            `Bu etkinlik için değerlendirme ${
              permRes.data.eventStatus === "completed"
                ? "süresi dolmuş"
                : "henüz açılmamış"
            }.`
          );
      } catch {
        setCanReview(true);
      }

      const [membersRes, eventRes] = await Promise.all([
        leaderApi.getTeamMembersForReview(eventId),
        leaderApi.getEventDetails(eventId),
      ]);
      setMembers(membersRes.data);
      setEventName(eventRes.data.event?.name || "Etkinlik");

      const reviewMap = new Map<string, ReviewData>();
      membersRes.data.forEach((member: TeamMember) => {
        if (member.existingReview) {
          reviewMap.set(member.id, {
            staffId: member.id,
            categoryScores: member.existingReview.categoryScores || {
              ...defaultCategoryScores,
            },
            strengths: member.existingReview.strengths || [],
            improvements: member.existingReview.improvements || [],
            comment: member.existingReview.comment || "",
            privateNotes: member.existingReview.privateNotes || "",
            nextEventNotes: member.existingReview.nextEventNotes || "",
            isCompleted: member.existingReview.isCompleted || false,
          });
        } else {
          reviewMap.set(member.id, {
            staffId: member.id,
            categoryScores: { ...defaultCategoryScores },
            strengths: [],
            improvements: [],
            comment: "",
            privateNotes: "",
            nextEventNotes: "",
            isCompleted: false,
          });
        }
      });
      setReviews(reviewMap);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (user?.role !== "leader") {
      router.push("/");
      return;
    }
    loadData();
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [user, loadData, router]);

  const updateReview = (
    staffId: string,
    field: keyof ReviewData,
    value: unknown
  ) => {
    setReviews((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(staffId) || {
        staffId,
        categoryScores: { ...defaultCategoryScores },
        strengths: [],
        improvements: [],
        comment: "",
        privateNotes: "",
        nextEventNotes: "",
        isCompleted: false,
      };
      const updated = { ...current, [field]: value };
      newMap.set(staffId, updated);
      if (canReview) scheduleAutoSave(staffId, updated);
      return newMap;
    });
  };

  const updateCategoryScore = (
    staffId: string,
    category: keyof CategoryScores,
    value: number
  ) => {
    setReviews((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(staffId);
      if (current) {
        const updated = {
          ...current,
          categoryScores: { ...current.categoryScores, [category]: value },
        };
        newMap.set(staffId, updated);
        if (canReview) scheduleAutoSave(staffId, updated);
      }
      return newMap;
    });
  };

  const completedCount = Array.from(reviews.values()).filter(
    (r) => r.isCompleted || Object.values(r.categoryScores).some((v) => v !== 3)
  ).length;

  if (loading)
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );

  if (!canReview && members.length === 0)
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12">
          <ShieldAlert className="w-12 h-12 text-amber-400 mb-4" />
          <p className="text-slate-400">
            {permissionMessage || "Bu etkinlik için değerlendirme yapılamaz"}
          </p>
          <Button onClick={() => router.push("/leader")} className="mt-4">
            Geri Dön
          </Button>
        </div>
      </PageContainer>
    );

  if (members.length === 0)
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

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              icon={<BarChart3 className="w-6 h-6 text-amber-400" />}
            />
          </div>
          <Badge variant="outline" className="text-slate-400">
            {completedCount}/{members.length} Tamamlandı
          </Badge>
        </div>

        {/* Permission Warning */}
        {!canReview && (
          <Card className="bg-amber-500/10 border-amber-500/50">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <p className="text-amber-400 text-sm">
                {permissionMessage} Sadece görüntüleme modundasınız.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">İlerleme</span>
            <span className="text-sm text-white">
              {Math.round((completedCount / members.length) * 100)}%
            </span>
          </div>
          <Progress
            value={(completedCount / members.length) * 100}
            className="h-2"
          />
        </div>

        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              review={reviews.get(member.id)}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>

        {/* Back Button */}
        {canReview && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => router.push("/leader")}
              className="border-slate-600"
            >
              Geri Dön
            </Button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedMember && reviews.get(selectedMember.id) && (
        <ReviewModal
          member={selectedMember}
          review={reviews.get(selectedMember.id)!}
          onClose={() => setSelectedMember(null)}
          onUpdateReview={(field, value) =>
            updateReview(selectedMember.id, field, value)
          }
          onUpdateCategoryScore={(category, value) =>
            updateCategoryScore(selectedMember.id, category, value)
          }
          canReview={canReview}
          autoSaveStatus={autoSaveStatus}
        />
      )}
    </PageContainer>
  );
}
