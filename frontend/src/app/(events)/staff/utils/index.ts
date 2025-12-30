import { API_BASE } from "@/lib/api";

/**
 * Avatar URL'ini oluşturur
 */
export const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

// Re-export position categories
export {
  POSITION_CATEGORIES,
  CATEGORY_ORDER,
  getPositionCategory,
  getCategoryInfo,
} from "./position-categories";
export type { PositionCategory } from "./position-categories";

/**
 * Değerlendirme puanına göre renk döndürür
 */
export const getScoreColor = (score: number): string => {
  if (score >= 4.5) return "text-green-400";
  if (score >= 3.5) return "text-blue-400";
  if (score >= 2.5) return "text-amber-400";
  return "text-red-400";
};

/**
 * Değerlendirme ortalamasını hesaplar
 */
export const calculateAverageScore = (
  reviews: Array<{ isCompleted: boolean; overallScore: number }>
): string => {
  if (reviews.length === 0) return "0";
  const completedReviews = reviews.filter((r) => r.isCompleted);
  if (completedReviews.length === 0) return "0";
  const total = completedReviews.reduce((sum, r) => sum + r.overallScore, 0);
  return (total / completedReviews.length).toFixed(1);
};

/**
 * İsimden baş harfleri alır
 */
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

/**
 * Geri sayım hesaplar
 */
export const calculateCountdown = (targetDate: string, targetTime?: string) => {
  const now = new Date().getTime();
  const eventDateTime = new Date(targetDate);

  if (targetTime) {
    const [hours, minutes] = targetTime.split(":").map(Number);
    eventDateTime.setHours(hours, minutes, 0, 0);
  }

  const distance = eventDateTime.getTime() - now;

  if (distance < 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
    isPast: false,
  };
};
