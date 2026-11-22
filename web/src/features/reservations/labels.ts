import type { ReservationStatus } from "@/domain/reservation-status";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Bekliyor",
  confirmed: "Onaylı",
  checked_in: "Giriş yaptı",
  cancelled: "İptal edildi",
  no_show: "Gelmedi",
};
