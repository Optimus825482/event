import { headers } from "next/headers";
import { auth } from "@/features/auth/auth";

/** İsteğin oturum kimliği (parola değişince bu oturum açık kalır); çözülemezse `null`. */
export async function currentSessionId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  return session?.session.id ?? null;
}

/**
 * İsteğin oturumunun bitiş zamanı (epoch ms); oturum yoksa `null`. Kabuk bunu istemciye verir; böylece
 * oturum süresi uyarısı her sayfa yüklemesinde hız sınırına tabi `get-session` uç noktasını çağırmaz.
 */
export async function currentSessionExpiry(): Promise<number | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const expiresAt = session?.session.expiresAt;
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}
