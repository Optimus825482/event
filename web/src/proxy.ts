import { NextResponse, type NextRequest } from "next/server";

// Better Auth çerez adı: üretimde `__Secure-` önekli. Yalnızca VARLIĞI denetlenir (veritabanı yok);
// gerçek doğrulama `(app)/layout.tsx` içinde `requireActor()` ile yapılır.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health", "/i"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();

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
