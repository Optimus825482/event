import type { EventStatus } from "@/domain/event-status";

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  active: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};
