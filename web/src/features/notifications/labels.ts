import type { NotificationRow } from "./service";

export const PRIORITY_LABELS: Record<NotificationRow["priority"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

export const TARGET_ROLE_LABELS: Record<NotificationRow["targetRole"], string> = {
  all: "Herkes",
  admin: "Yöneticiler",
  leader: "Ekip liderleri",
  staff: "Personel",
};
