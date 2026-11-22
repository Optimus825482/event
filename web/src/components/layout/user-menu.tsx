"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SIGN_OUT_PENDING_EVENT, requestServerSignOut, runSignOut } from "@/features/auth/sign-out";
import { purgeAuthenticatedShell } from "@/features/check-in/offline/purge-shell";

export function UserMenu({ username, roleLabel }: { username: string; roleLabel: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      // Sunucu çıkışı + (ortak cihaz) kabuk önbelleğini silme. Sunucuya ulaşılamazsa çıkış ertelenir:
      // cihaz "çıkış bekliyor" diye işaretlenir ve `PendingSignOut` arayüzü kilitleyip yeniden dener.
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

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium">{username}</p>
        <p className="text-xs text-muted-foreground">{roleLabel}</p>
      </div>
      <Button variant="outline" size="sm" onClick={signOut} disabled={pending}>
        {pending ? "Çıkış yapılıyor…" : "Çıkış yap"}
      </Button>
    </div>
  );
}
