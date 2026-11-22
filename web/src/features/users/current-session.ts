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
