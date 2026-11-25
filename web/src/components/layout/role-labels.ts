import type { Role } from "@/features/auth/roles";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Sistem Yöneticisi",
  organizer: "Organizatör",
  staff: "Personel",
  leader: "Ekip lideri",
  controller: "Kontrolör",
  venue_owner: "Mekân sahibi",
  user: "Kullanıcı",
};
