// Yetki departman üyeliklerinden gelir; rol yalnızca Sistem Yöneticisini ayırır.
export const ROLES = ["admin", "user"] as const;

export type Role = (typeof ROLES)[number];
