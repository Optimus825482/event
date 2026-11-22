"use client";

import { Download, Smartphone, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "eventflow-install-dismissed";

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return "prompt" in event && typeof event.prompt === "function";
}

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Depolama kapalıysa kapatma yalnızca bu bileşen ömrü boyunca geçerli olur.
  }
}

/** Yükleme istemi (eski `InstallBanner`): tarayıcı `beforeinstallprompt` verirse alttan çıkar. */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(event: Event) {
      if (!isInstallPromptEvent(event)) return;
      event.preventDefault();
      if (!readDismissed()) setPromptEvent(event);
    }
    function onInstalled() {
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  function dismiss() {
    writeDismissed();
    setPromptEvent(null);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  return (
    <div role="region" aria-label="Uygulamayı yükle" className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-700 bg-slate-800 p-4 shadow-lg">
      <div className="mx-auto max-w-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Smartphone className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">EventFlow PRO&apos;yu Yükle</h3>
            <p className="mt-1 text-xs text-slate-400">Ana ekranınıza ekleyin, daha hızlı erişin ve çevrimdışı kullanın.</p>
          </div>
          <button type="button" onClick={dismiss} className="shrink-0 p-1 text-slate-400 transition-colors hover:text-white" aria-label="Kapat">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <Button type="button" variant="outline" size="sm" onClick={dismiss} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700">
            Şimdi Değil
          </Button>
          <Button type="button" size="sm" onClick={() => void install()} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
            <Download aria-hidden="true" />
            Yükle
          </Button>
        </div>
      </div>
    </div>
  );
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Bağlantı durumu şeridi (eski `OfflineIndicator`): kopunca amber, dönünce 3 sn yeşil. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = window.setTimeout(() => setReconnected(true), 0);
    const hide = window.setTimeout(() => setReconnected(false), 3000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [online]);

  const offline = !online;
  if (!offline && !reconnected) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
        offline ? "bg-amber-500 text-amber-950" : "bg-green-600 text-white"
      }`}
    >
      {offline ? <WifiOff className="h-4 w-4" aria-hidden="true" /> : <Wifi className="h-4 w-4" aria-hidden="true" />}
      <span>{offline ? "Çevrimdışı - İnternet bağlantınız yok" : "Bağlantı sağlandı"}</span>
    </div>
  );
}
