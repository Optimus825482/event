"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { purgeAuthenticatedShell } from "@/features/check-in/offline/purge-shell";

export function UserMenu({ username, roleLabel }: { username: string; roleLabel: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
    } finally {
      // Ortak cihaz: yönlendirmeden önce çevrimdışı kabuk önbelleği silinir (hata olursa çıkış sürer).
      await purgeAuthenticatedShell();
      router.replace("/login");
      router.refresh();
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
