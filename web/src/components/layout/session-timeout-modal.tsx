"use client";

import { Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WARNING_LEAD_MS, formatRemaining, msUntilWarning, parseSessionExpiry, remainingMs } from "./session-timeout";
import { useSignOut } from "./use-sign-out";

async function fetchExpiry(): Promise<number | null> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    return parseSessionExpiry(await res.json());
  } catch {
    return null;
  }
}

/**
 * Oturum bitmeden önce uyarı penceresi (eski `SessionTimeoutModal`). İlk bitiş zamanı sunucudan (kabuk
 * düzeni) gelir; sayfa yüklemesinde `get-session` çağrılmaz (uç nokta hız sınırlıdır). Uyarı zamanı
 * geldiğinde ve "Oturumu uzat"ta oturum yeniden okunur (sunucu kaydırmalı yenileme
 * yapar) ve geri sayım süre uzadıysa kapanır. Süre dolarsa oturum kapatılır.
 */
export function SessionTimeoutModal({ initialExpiresAt }: { initialExpiresAt: number | null }) {
  const [expiresAt, setExpiresAt] = useState<number | null>(initialExpiresAt);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notExtended, setNotExtended] = useState(false);
  const { pending, signOut } = useSignOut();
  const expiredRef = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchExpiry();
    setExpiresAt(next);
    return next;
  }, []);

  useEffect(() => {
    if (expiresAt === null) return;
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      if (expiresAt - Date.now() <= WARNING_LEAD_MS) setOpen(true);
      else void refresh();
    }, msUntilWarning(expiresAt, Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, refresh]);

  useEffect(() => {
    if (!open) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [open]);

  const left = expiresAt === null ? 0 : remainingMs(expiresAt, now);

  useEffect(() => {
    if (!open || expiresAt === null || left > 0 || expiredRef.current) return;
    expiredRef.current = true;
    void signOut();
  }, [open, expiresAt, left, signOut]);

  async function extend() {
    const next = await refresh();
    if (next !== null && next - Date.now() > WARNING_LEAD_MS) {
      setNotExtended(false);
      setOpen(false);
    } else {
      setNotExtended(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" aria-hidden="true" />
            Oturum süresi dolmak üzere
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Güvenliğiniz için oturumunuz kapanacak. Devam etmek için oturumu uzatın.
          </DialogDescription>
        </DialogHeader>
        <p className="text-center text-4xl font-bold tabular-nums text-amber-400" role="timer" aria-live="off">
          {formatRemaining(left)}
        </p>
        {notExtended ? (
          <p role="alert" className="text-center text-sm text-red-400">
            Oturum uzatılamadı. Lütfen çıkış yapıp yeniden giriş yapın.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => void signOut()} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            Çıkış yap
          </Button>
          <Button type="button" onClick={() => void extend()} className="bg-blue-600 text-white hover:bg-blue-700">
            Oturumu uzat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
