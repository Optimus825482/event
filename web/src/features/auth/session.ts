import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "./auth";
import { UnauthenticatedError } from "./errors";
import type { Role } from "./roles";

export type Actor = {
  id: string;
  username: string;
  role: Role;
  staffId: string | null;
};

/**
 * İstek başlıklarındaki oturum çerezinden işlemi yapan kullanıcıyı çözer.
 * Kullanıcı satırı her çağrıda veritabanından yeniden okunur; böylece pasife
 * alınan kullanıcı geçerli bir çerezle de çalışmaya devam edemez.
 *
 * @internal Next istek kapsamı dışında (testlerde) kullanılmak üzere dışa aktarılır.
 */
export async function getActorFromHeaders(requestHeaders: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      staffId: users.staffId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!row || !row.isActive) return null;

  return { id: row.id, username: row.username, role: row.role, staffId: row.staffId };
}

export async function getActor(): Promise<Actor | null> {
  return getActorFromHeaders(await headers());
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthenticatedError();
  return actor;
}
