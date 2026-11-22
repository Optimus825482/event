"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIGN_OUT_PENDING_EVENT, requestServerSignOut, runSignOut } from "@/features/auth/sign-out";
import { purgeAuthenticatedShell } from "@/features/check-in/offline/purge-shell";

/**
 * Çıkış akışı (davranış değişmedi): sunucu çıkışı + (ortak cihaz) kabuk önbelleğini silme. Sunucuya
 * ulaşılamazsa çıkış ertelenir: cihaz "çıkış bekliyor" diye işaretlenir ve `PendingSignOut`
 * arayüzü kilitleyip yeniden dener.
 */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const outcome = await runSignOut({
        request: requestServerSignOut,
        purge: purgeAuthenticatedShell,
        store: window.localStorage,
      });
      if (outcome === "complete") {
        router.replace("/login");
        router.refresh();
      } else {
        window.dispatchEvent(new Event(SIGN_OUT_PENDING_EVENT));
      }
    } finally {
      setPending(false);
    }
  }

  return { pending, signOut };
}
