"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { dismissUpdate, initialUpdateState, onControllerChange, type UpdatePromptState } from "./update-prompt-state";

type Action = { type: "controllerchange" } | { type: "dismiss" };

function reducer(state: UpdatePromptState, action: Action): UpdatePromptState {
  return action.type === "controllerchange" ? onControllerChange(state) : dismissUpdate(state);
}

/**
 * Yeni sürüm devraldığında alt sağda küçük bir istem gösterir. Sayfa asla kendiliğinden yenilenmez:
 * çevrimdışı check-in kuyruğunda bekleyen kayıtlar olabilir; yalnızca "Yenile" tıklanınca yenilenir.
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

  if (!state.visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 shadow-xl"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
      <span className="text-sm font-medium text-white">Yeni sürüm hazır</span>
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
