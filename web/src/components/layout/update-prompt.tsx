"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { APP_BUILD, buildLabel, normalizeBuild } from "@/lib/app-build";
import { dismissUpdate, initialUpdateState, onControllerChange, onServerBuild, type UpdatePromptState } from "./update-prompt-state";

type Action = { type: "controllerchange" } | { type: "dismiss" } | { type: "server-build"; build: string | null };

function reducer(state: UpdatePromptState, action: Action): UpdatePromptState {
  if (action.type === "controllerchange") return onControllerChange(state);
  if (action.type === "server-build") return onServerBuild(state, APP_BUILD, action.build);
  return dismissUpdate(state);
}

/** Açık sekme sunucuyu bu aralıkla yoklar; ayrıca sekme öne geldiğinde ve bağlantı döndüğünde. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function fetchServerBuild(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch("/api/version", { cache: "no-store", signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "build" in body ? normalizeBuild(body.build) : null;
  } catch {
    // Çevrimdışı, oturum bitmiş ya da dağıtım sürüyor: sonraki yoklamada yeniden denenir.
    return null;
  }
}

/**
 * Sistem güncellendiğinde alt sağda küçük bir istem gösterir. Sayfa asla kendiliğinden yenilenmez:
 * çevrimdışı check-in kuyruğunda bekleyen kayıtlar ya da yarım kalmış bir form olabilir; yalnızca
 * "Yenile" tıklanınca yenilenir.
 */
export function UpdatePrompt() {
  // Açılışta denetleyici yoksa ilk `controllerchange` ilk kurulumdur, güncelleme değil.
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialUpdateState(typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller !== null),
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    const onChange = () => dispatch({ type: "controllerchange" });
    container.addEventListener("controllerchange", onChange);
    return () => container.removeEventListener("controllerchange", onChange);
  }, []);

  useEffect(() => {
    // Numarasız derleme (yerel geliştirme): karşılaştıracak bir şey yok, sunucu yoklanmaz.
    if (!APP_BUILD) return;
    const controller = new AbortController();
    const check = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void fetchServerBuild(controller.signal).then((build) => {
        if (!controller.signal.aborted) dispatch({ type: "server-build", build });
      });
    };
    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 shadow-xl"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
      <span className="text-sm font-medium text-white">
        Sistem güncellendi
        {state.serverBuild && <span className="ml-1.5 font-normal text-slate-400">{buildLabel(state.serverBuild)}</span>}
      </span>
      <Button type="button" size="sm" onClick={() => window.location.reload()} className="bg-green-600 text-white hover:bg-green-700">
        Yenile
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => dispatch({ type: "dismiss" })}
        className="border-slate-600 text-slate-300 hover:bg-slate-700"
      >
        Sonra
      </Button>
    </div>
  );
}
