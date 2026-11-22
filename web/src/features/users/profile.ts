import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { users } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { checkAvatarDataUrl, displayableAvatar } from "./avatar";
import type { SetOwnAvatarInput } from "./schemas";

const MESSAGES = { notFound: "Hesap bulunamadı" } as const;

/**
 * Oturumdaki kullanıcının kendi profil fotoğrafını yazar ya da kaldırır. Yetki: yalnızca kendi
 * satırı (`actor.id`) ve yalnızca aktif hesap; başka kullanıcının fotoğrafı bu yoldan değişemez.
 * Şema zaten doğrular; servis aynı denetimi yineler (doğrudan çağrılara karşı ikinci savunma).
 */
export async function setOwnAvatar(
  db: Db | Tx,
  actor: Actor,
  input: SetOwnAvatarInput,
): Promise<{ hasAvatar: boolean }> {
  if (input.image !== null) {
    const check = checkAvatarDataUrl(input.image);
    if (!check.ok) throw new DomainError("invalid", check.message);
  }
  const [row] = await db
    .update(users)
    .set({ image: input.image })
    .where(and(eq(users.id, actor.id), eq(users.isActive, true)))
    .returning({ id: users.id });
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return { hasAvatar: input.image !== null };
}

/** Kabuk ve profil sayfası için kendi fotoğrafı; gösterilemeyecek eski değerler `null` döner. */
export async function getOwnAvatar(db: Db | Tx, actor: Actor): Promise<string | null> {
  const [row] = await db.select({ image: users.image }).from(users).where(eq(users.id, actor.id));
  return displayableAvatar(row?.image);
}
