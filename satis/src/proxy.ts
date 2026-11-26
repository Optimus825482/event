import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/csp";
import { isPrivatePath, privateHeaders } from "@/lib/security-headers";

/**
 * Her istek için yeni nonce'lu CSP üretir; Next, istek başlığındaki CSP'den nonce'u çıkarıp kendi
 * betiklerine ekler. Sipariş belirteçli yollara `noindex` ve `no-store` eklenir.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, production: process.env.NODE_ENV === "production" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (isPrivatePath(request.nextUrl.pathname)) {
    for (const { key, value } of privateHeaders()) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  // API, statik dosyalar ve Next iç yolları hariç her şey.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
