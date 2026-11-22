/**
 * Çıkış mantığı. Çevrimdışıyken sunucu oturumu kapatılamaz; bu durumda çıkış "ertelenir":
 * kabuk önbelleği yine silinir, cihaz "çıkış bekliyor" diye işaretlenir, arayüz engellenir ve
 * bağlantı gelince (ya da bir sonraki yüklemede) sunucu çıkışı yeniden denenir.
 */

export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SignOutRequestResult = { kind: "response"; status: number } | { kind: "network-error" };
export type SignOutOutcome = "complete" | "deferred";

export const SIGN_OUT_PENDING_KEY = "eventflow-signout-pending";
export const SIGN_OUT_PENDING_EVENT = "eventflow:signout-pending";

/** 2xx: oturum kapandı. 401: zaten oturum yok. Diğer her şey (ağ, 5xx, 403, 429…) oturumu açık bırakabilir. */
export function classifySignOut(result: SignOutRequestResult): SignOutOutcome {
  if (result.kind === "network-error") return "deferred";
  return (result.status >= 200 && result.status < 300) || result.status === 401 ? "complete" : "deferred";
}

export function isSignOutPending(store: KeyValueStore | undefined): boolean {
  try {
    return store?.getItem(SIGN_OUT_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSignOutPending(store: KeyValueStore | undefined): void {
  try {
    store?.setItem(SIGN_OUT_PENDING_KEY, "1");
  } catch {
    // depo kapalı: yalnızca bellekteki durum kalır
  }
}

export function clearSignOutPending(store: KeyValueStore | undefined): void {
  try {
    store?.removeItem(SIGN_OUT_PENDING_KEY);
  } catch {
    // yoksay
  }
}

/** Giriş ve herkese açık davetiye sayfaları engellenmez; geri kalan her sayfa engellenir. */
export function shouldBlockPath(pathname: string): boolean {
  return !["/login", "/i"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type RunSignOutDeps = {
  request: () => Promise<SignOutRequestResult>;
  purge: () => Promise<void>;
  store: KeyValueStore | undefined;
};

/** Sunucu çıkışını dener, kabuğu siler, sonuca göre bekleyen işaretini koyar ya da temizler. */
export async function runSignOut({ request, purge, store }: RunSignOutDeps): Promise<SignOutOutcome> {
  const outcome = classifySignOut(await request());
  try {
    // Ortak cihaz: sonuç ne olursa olsun çevrimdışı kabuk silinir.
    await purge();
  } catch {
    // kabuk silinemese de çıkış sürer
  }
  if (outcome === "complete") clearSignOutPending(store);
  else markSignOutPending(store);
  return outcome;
}

/** Tarayıcıda `fetch` ile Better Auth çıkış ucunu çağırır. */
export async function requestServerSignOut(): Promise<SignOutRequestResult> {
  try {
    const res = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    return { kind: "response", status: res.status };
  } catch {
    return { kind: "network-error" };
  }
}
