import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { clearLoginAttempts, registerLoginAttempt } from "./login-attempts";
import { isValidUsername } from "./username";

/**
 * HTTP üzerinden erişilebilen Better Auth uçları (varsayılan: reddet).
 * Listede olmayan her yol ve yöntem, gelecekte eklenecek uçlar dahil, 404 döner.
 * Yalnızca HTTP işleyicisini etkiler; sunucudaki `auth.api.*` ve
 * `internalAdapter` çağrıları çalışmaya devam eder.
 */
export const ALLOWED_ENDPOINTS: Readonly<Record<string, readonly string[]>> = {
  "/sign-in/username": ["POST"],
  "/sign-out": ["POST"],
  "/get-session": ["GET"],
  "/ok": ["GET"],
};

const TOO_MANY_LOGIN_ATTEMPTS = {
  code: "TOO_MANY_LOGIN_ATTEMPTS",
  message: "Too many login attempts. Try again later.",
} as const;

function endpointPath(requestUrl: string, baseURL: string): string | null {
  const base = new URL(baseURL).pathname.replace(/\/+$/, "");
  const pathname = new URL(requestUrl).pathname;
  if (!pathname.startsWith(`${base}/`)) return null;
  return pathname.slice(base.length);
}

export function isAllowedRequest(request: Request, baseURL: string): boolean {
  const path = endpointPath(request.url, baseURL);
  if (path === null || !Object.hasOwn(ALLOWED_ENDPOINTS, path)) return false;
  return ALLOWED_ENDPOINTS[path]?.includes(request.method) ?? false;
}

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

function signInUsername(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("username" in body)) return null;
  const { username } = body;
  return typeof username === "string" && isValidUsername(username) ? username : null;
}

type IpSource = {
  request?: Request;
  headers?: Headers;
  context: { options: Parameters<typeof getIP>[1] };
};

/** Better Auth IP sınırıyla aynı kaynak: yalnızca yapılandırılmış güvenilir başlık. */
function clientIp(ctx: IpSource): string | null {
  const source = ctx.request ?? ctx.headers;
  return source ? getIP(source, ctx.context.options) : null;
}

function sessionUser(returned: unknown): { id: string; isActive: unknown } | null {
  if (typeof returned !== "object" || returned === null || !("user" in returned)) return null;
  const { user } = returned;
  if (typeof user !== "object" || user === null || !("id" in user) || typeof user.id !== "string") return null;
  return { id: user.id, isActive: "isActive" in user ? user.isActive : undefined };
}

export function eventflowGuard() {
  return {
    id: "eventflow-guard",
    async onRequest(request, ctx) {
      if (!isAllowedRequest(request, ctx.baseURL)) return { response: notFound() };
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/username",
          handler: createAuthMiddleware(async (ctx) => {
            const username = signInUsername(ctx.body);
            // Biçimce geçersiz ad sayılmaz; uç onu zaten reddeder (tablo şişirilemez).
            if (username === null) return;
            if (await registerLoginAttempt(username, clientIp(ctx))) {
              throw APIError.from("TOO_MANY_REQUESTS", TOO_MANY_LOGIN_ATTEMPTS);
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/username",
          handler: createAuthMiddleware(async (ctx) => {
            const username = signInUsername(ctx.body);
            if (username !== null && !isAPIError(ctx.context.returned)) {
              await clearLoginAttempts(username, clientIp(ctx));
            }
          }),
        },
        {
          // Pasif kullanıcının oturumu, is_active veritabanında doğrudan değişse bile geçersizdir.
          matcher: (ctx) => ctx.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            const user = sessionUser(ctx.context.returned);
            if (!user || user.isActive === true) return;
            await ctx.context.internalAdapter.deleteUserSessions(user.id);
            deleteSessionCookie(ctx);
            return ctx.json(null);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
