import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";

/**
 * Kullanıcıyı pasife alır ve tüm oturumlarını aynı işlemde siler; eski
 * çerezlerle hiçbir istek kimlik doğrulamasından geçemez.
 * Yetki denetimi çağıran sunucu eyleminin sorumluluğundadır.
 */
export async function deactivateUser(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: false }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

/** Kullanıcıyı yeniden etkinleştirir; yeni giriş gerekir. */
export async function reactivateUser(userId: string): Promise<void> {
  await db.update(users).set({ isActive: true }).where(eq(users.id, userId));
}
