import type { EventStatus } from "@/domain/event-status";

export type BoardTab = "planning" | "upcoming" | "completed";

export const BOARD_TABS: readonly BoardTab[] = ["planning", "upcoming", "completed"];

export const BOARD_TAB_CONFIG: Record<BoardTab, { label: string; description: string; emptyText: string }> = {
  planning: {
    label: "Planlama Aşamasında",
    description: "Alan düzeni veya ekip organizasyonu tamamlanmamış etkinlikler",
    emptyText: "Planlama bekleyen etkinlik yok",
  },
  upcoming: {
    label: "Gelecek Etkinlikler",
    description: "Alan düzeni ve ekibi hazır, yaklaşan etkinlikler",
    emptyText: "Hazırlığı tamamlanmış gelecek etkinlik yok",
  },
  completed: {
    label: "Tamamlanan",
    description: "Tarihi geçmiş ya da kapatılmış etkinlikler",
    emptyText: "Tamamlanan etkinlik yok",
  },
};

export function parseBoardTab(value: string | undefined): BoardTab {
  return BOARD_TABS.find((t) => t === value) ?? "planning";
}

export type BoardEvent = {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date | null;
  eventType: string | null;
  reservationEnabled: boolean;
  reservationCount: number;
  tableCount: number;
  assignmentCount: number;
};

export const hasVenue = (e: Pick<BoardEvent, "tableCount">) => e.tableCount > 0;
export const hasTeam = (e: Pick<BoardEvent, "assignmentCount">) => e.assignmentCount > 0;

/** Türkiye'de yaz saati yok (UTC+3 sabit): günün başlangıcı bu ofsetle bulunur. */
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

/** Verilen anın İstanbul takvimindeki gün başlangıcı. */
export function istanbulDayStart(now: Date): Date {
  const shifted = now.getTime() + ISTANBUL_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - ISTANBUL_OFFSET_MS);
}

/**
 * Eski panodaki gibi: bugünden önceki (ya da tamamlanmış/iptal) etkinlikler "tamamlanan";
 * kalanlar alan düzeni ve ekip hazırsa "gelecek", değilse "planlama".
 */
export function boardTabOf(event: BoardEvent, now: Date): BoardTab {
  if (event.status === "completed" || event.status === "cancelled") return "completed";
  if (event.startsAt.getTime() < istanbulDayStart(now).getTime()) return "completed";
  return hasVenue(event) && hasTeam(event) ? "upcoming" : "planning";
}

export function groupBoard(events: readonly BoardEvent[], now: Date): Record<BoardTab, BoardEvent[]> {
  const groups: Record<BoardTab, BoardEvent[]> = { planning: [], upcoming: [], completed: [] };
  for (const event of events) groups[boardTabOf(event, now)].push(event);
  // Yaklaşan ve planlanan etkinlikler en yakın tarih önce; tamamlananlar en yeni önce.
  groups.planning.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  groups.upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  groups.completed.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return groups;
}

/** Rozet metni: "5 saat", "Yarın", "12 gün". Başlamış etkinlik için `null`. */
export function countdownLabel(startsAt: Date, now: Date): string | null {
  const diff = startsAt.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / 3_600_000);
  if (days === 0) return `${hours} saat`;
  if (days === 1) return "Yarın";
  return `${days} gün`;
}

export type CountdownParts = { days: number; hours: number; minutes: number };

export function countdownParts(startsAt: Date, now: Date): CountdownParts | null {
  const diff = startsAt.getTime() - now.getTime();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  };
}

/** Etkinlik türü: serbest metin; bilinen türler eski arayüzdeki renkleri alır. */
export const EVENT_TYPE_SUGGESTIONS = ["Konser", "Stand Up Show", "Party", "Konferans", "Diğer"] as const;

const TYPE_COLORS: Record<string, string> = {
  konser: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "stand up show": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  party: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  konferans: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const DEFAULT_TYPE_COLOR = "bg-slate-500/20 text-slate-400 border-slate-500/30";

export function eventTypeBadge(type: string | null): { label: string; color: string } {
  const label = type?.trim() ? type.trim() : "Diğer";
  return { label, color: TYPE_COLORS[label.toLocaleLowerCase("tr-TR")] ?? DEFAULT_TYPE_COLOR };
}

/** Sihirbazda gösterilen şablon özeti (alan ve ekip şablonları için ortak). */
export type WizardTemplate = { id: string; name: string; description: string | null; detail: string };
