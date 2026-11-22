import { users } from "@/db/schema";

/** Kullanıcı listesi/ayrıntısında dönen sütunlar: parola ve hesap tabloları hiçbir zaman seçilmez. */
export const USER_COLUMNS = {
  id: users.id,
  username: users.username,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  staffId: users.staffId,
  color: users.color,
  phone: users.phone,
  position: users.position,
  createdAt: users.createdAt,
} as const;

export type UserSummary = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: (typeof users.$inferSelect)["role"];
  isActive: boolean;
  staffId: string | null;
  color: string | null;
  phone: string | null;
  position: string | null;
  createdAt: Date;
};
