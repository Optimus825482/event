import type { EventStatus } from "@/domain/event-status";

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  active: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

/** Durum değiştirme düğmesinin metni: hedef duruma geçiren fiil. */
export const EVENT_TRANSITION_ACTIONS: Record<EventStatus, { label: string }> = {
  draft: { label: "Taslağa al" },
  published: { label: "Yayınla" },
  active: { label: "Başlat" },
  completed: { label: "Tamamla" },
  cancelled: { label: "İptal et" },
};

/** Geri dönüşü olmayan (terminal) hedefler onay ister; diğerleri doğrudan uygulanır. */
export function transitionConfirmation(to: EventStatus): { title: string; description: string } | null {
  if (to === "cancelled") {
    return { title: "Etkinlik iptal edilsin mi?", description: "İptal edilen etkinlik yeniden açılamaz. Bu işlem geri alınamaz." };
  }
  if (to === "completed") {
    return { title: "Etkinlik tamamlansın mı?", description: "Tamamlanan etkinlik yeniden açılamaz. Bu işlem geri alınamaz." };
  }
  return null;
}
