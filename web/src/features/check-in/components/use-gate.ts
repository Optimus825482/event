"use client";

import { useCallback, useSyncExternalStore } from "react";
import { GATE_STORAGE_KEY, parseGate } from "../gates";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): number | null {
  try {
    return parseGate(window.localStorage.getItem(GATE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Cihazın seçili kapısı: etkinlikten bağımsız `localStorage`'da; sunucuda ve depolama yokken `null`. */
export function useGate(): { gate: number | null; setGate: (next: number | null) => void } {
  const gate = useSyncExternalStore(subscribe, read, () => null);
  const setGate = useCallback((next: number | null) => {
    try {
      if (next === null) window.localStorage.removeItem(GATE_STORAGE_KEY);
      else window.localStorage.setItem(GATE_STORAGE_KEY, String(next));
    } catch {
      // Depolama kullanılamıyor: seçim kalıcı olmaz.
    }
    for (const l of listeners) l();
  }, []);
  return { gate, setGate };
}
