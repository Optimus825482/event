import type { Actor } from "@/features/auth/session";

/**
 * Satış API'sinin aktörü. Yalnızca `Actor` isteyen mevcut imzalar (`lockEvent` gibi) içindir;
 * hiçbir rolü, üyeliği ya da izni yoktur, yetki denetiminden geçemez.
 */
export const SALES_ACTOR: Actor = {
  id: "00000000-0000-0000-0000-000000000000",
  username: "sales-api",
  role: "user",
  staffId: null,
  memberships: [],
  permissions: [],
};
