import { DEPARTMENT_LABELS } from "@/features/auth/departments";
import type { NotificationRow } from "./service";

export const PRIORITY_LABELS: Record<NotificationRow["priority"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

export const AUDIENCE_LABELS: Record<NotificationRow["audience"], string> = {
  all: "Herkes",
  admin: "Sistem Yöneticileri",
  entertainment: DEPARTMENT_LABELS.entertainment,
  fnb: DEPARTMENT_LABELS.fnb,
  casino: DEPARTMENT_LABELS.casino,
};
