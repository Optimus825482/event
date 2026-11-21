import { createAuth } from "@/features/auth/auth";

export const BASE_URL = "http://localhost:3000";
export const PASSWORD = "GucluParola!2024";
export const WRONG_PASSWORD = "YanlisParola!2024";

type Handler = { handler: (request: Request) => Promise<Response> };

/**
 * Traefik arkasındaki kurulumu taklit eder: istemci IP'si `x-forwarded-for`
 * başlığından okunur, böylece testler birbirinin IP kotasını tüketmez.
 */
export const trustedAuth = createAuth({
  production: false,
  baseURL: BASE_URL,
  trustedIpHeader: "x-forwarded-for",
});

let ipCounter = 0;
/** Her çağrıda farklı bir istemci IP'si. */
export function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 62500) % 250}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  ip?: string;
  cookie?: string;
  instance?: Handler;
  baseURL?: string;
};

export function call(path: string, options: RequestOptions = {}): Promise<Response> {
  const baseURL = options.baseURL ?? BASE_URL;
  const method = options.method ?? "POST";
  const headers = new Headers({ origin: baseURL, "x-forwarded-for": options.ip ?? nextIp() });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (method === "POST") headers.set("content-type", "application/json");
  return (options.instance ?? trustedAuth).handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
    }),
  );
}

export function signIn(
  username: string,
  password: string,
  options: Omit<RequestOptions, "body" | "method"> = {},
): Promise<Response> {
  return call("/sign-in/username", { ...options, body: { username, password } });
}

export function sessionSetCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("Oturum çerezi bulunamadı");
  return cookie;
}

/** `Cookie` istek başlığı değeri (`ad=değer`). */
export function sessionCookie(res: Response): string {
  return sessionSetCookie(res).split(";")[0] ?? "";
}

export function hasSessionCookie(res: Response): boolean {
  return res.headers.getSetCookie().some((c) => c.includes("session_token="));
}

export async function signedInCookie(username: string, password: string = PASSWORD): Promise<string> {
  const res = await signIn(username, password);
  if (res.status !== 200) throw new Error(`Giriş başarısız: ${res.status}`);
  return sessionCookie(res);
}
