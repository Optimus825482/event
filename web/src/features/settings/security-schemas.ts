import { z } from "zod";

export const revokeSessionSchema = z.object({ sessionId: z.uuid() });

export const revokeOtherSessionsSchema = z.object({});

/** Kilidi kaldırılacak sayaç satırı: (kullanıcı adı, IP) ya da tüm IP'leri kapsayan `*` satırı. */
export const clearLockoutSchema = z.object({
  username: z.string().min(1).max(500),
  ip: z.string().min(1).max(100),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
export type ClearLockoutInput = z.infer<typeof clearLockoutSchema>;
