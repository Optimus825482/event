import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/csp";

// Better Auth çerez adı: üretimde `__Secure-` önekli. Yalnızca VARLIĞI denetlenir (veritabanı yok);
// gerçek doğrulama `(app)/layout.tsx` içinde `requireActor()` ile yapılır.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health", "/i"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Her istek için yeni nonce'lu CSP üretir; Next, istek başlığındaki CSP'den nonce'u çıkarıp kendi
 * betiklerine ekler. Bu yüzden nonce'lu CSP altındaki sayfalar dinamik üretilir (bkz. csp.ts).
 */
function passThrough(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, production: process.env.NODE_ENV === "production" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return passThrough(request);
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return passThrough(request);

  // API istemcileri (fetch, EventSource) giriş sayfasına yönlendirilmez; 401 alır.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Oturum gerekli" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Statik dosyalar ve Next iç yolları hariç her şey.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
