"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  SIGN_OUT_PENDING_EVENT,
  isSignOutPending,
  runSignOut,
  requestServerSignOut,
  shouldBlockPath,
} from "@/features/auth/sign-out";
import { purgeOnSignOut } from "@/features/check-in/offline/purge-queue";

const RETRY_INTERVAL_MS = 15_000;
const APP_ROOT_ID = "app-root";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SIGN_OUT_PENDING_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIGN_OUT_PENDING_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const readPending = () => isSignOutPending(window.localStorage);

/**
 * Çıkış sunucuya ulaşamadıysa (çevrimdışı) tüm uygulama sayfalarını kaplar ve etkileşime kapatır;
 * bağlantı gelince, yeniden yüklemede ve düzenli aralıkla sunucu çıkışını yeniden dener.
 */
export function PendingSignOut() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useSyncExternalStore(subscribe, readPending, () => false);
  const [busy, setBusy] = useState(false);
  const blocking = pending && shouldBlockPath(pathname);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      const outcome = await runSignOut({
        request: requestServerSignOut,
        purge: purgeOnSignOut,
        store: window.localStorage,
      });
      window.dispatchEvent(new Event(SIGN_OUT_PENDING_EVENT));
      if (outcome === "complete") {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }, [router]);

  // Bekleyen çıkış varken (yükleme dahil) bağlantı gelince ve aralıklarla yeniden dene.
  useEffect(() => {
    if (!pending) return;
    const first = setTimeout(() => void retry(), 0);
    const timer = setInterval(() => void retry(), RETRY_INTERVAL_MS);
    const onOnline = () => void retry();
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [pending, retry]);

  // Altındaki sayfa odaklanamaz/okunamaz olsun.
  useEffect(() => {
    const root = document.getElementById(APP_ROOT_ID);
    if (!root || !blocking) return;
    root.setAttribute("inert", "");
    return () => root.removeAttribute("inert");
  }, [blocking]);

  if (!blocking) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="pending-signout-title" className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 id="pending-signout-title" className="text-xl font-semibold">
          Çıkış tamamlanamadı
        </h1>
        <p className="text-sm text-muted-foreground">
          Sunucuya ulaşılamadığı için oturum kapatılamadı. Bağlantı gelince çıkış otomatik olarak tamamlanacak; o zamana kadar bu cihazdaki sayfalar kapalıdır.
        </p>
        <Button onClick={() => void retry()} disabled={busy}>
          {busy ? "Deneniyor…" : "Yeniden dene"}
        </Button>
      </div>
    </div>
  );
}
