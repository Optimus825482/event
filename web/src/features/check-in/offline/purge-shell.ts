/**
 * Çıkışta kimlik doğrulamalı kabuğun (service worker `eventflow-shell-*` önbelleği) silinmesi:
 * ortak cihazda bir sonraki kullanıcı, çıkış yapanın sayfalarını çevrimdışı açamasın.
 * Her şey savunmacıdır: service worker, Cache API ya da denetleyici yoksa sessizce geçilir ve çıkış
 * hiçbir zaman bunun yüzünden takılmaz (süre sınırı vardır).
 */

const SHELL_CACHE_PREFIX = "eventflow-shell-";
const PURGE_TIMEOUT_MS = 1_500;

export type PurgeEnv = {
  serviceWorker?: { controller?: { postMessage(message: unknown): void } | null };
  caches?: { keys(): Promise<string[]>; delete(name: string): Promise<boolean> };
};

function browserEnv(): PurgeEnv {
  return {
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    caches: typeof caches === "undefined" ? undefined : caches,
  };
}

async function deleteShellCaches(cacheApi: NonNullable<PurgeEnv["caches"]>): Promise<void> {
  const names = await cacheApi.keys();
  await Promise.all(names.filter((n) => n.startsWith(SHELL_CACHE_PREFIX)).map((n) => cacheApi.delete(n)));
}

export async function purgeAuthenticatedShell(env: PurgeEnv = browserEnv()): Promise<void> {
  try {
    // Worker'a haber ver: kendi önbellek tutamacıyla da siler ve sonraki istekte yeniden doldurmaz.
    env.serviceWorker?.controller?.postMessage({ type: "purge" });
  } catch {
    // worker kapanmış olabilir; doğrudan silme aşağıda
  }
  const cacheApi = env.caches;
  if (!cacheApi) return;
  try {
    await Promise.race([
      deleteShellCaches(cacheApi),
      new Promise<void>((resolve) => setTimeout(resolve, PURGE_TIMEOUT_MS)),
    ]);
  } catch {
    // önbellek erişilemiyor (özel pencere vb.): çıkış devam eder
  }
}
