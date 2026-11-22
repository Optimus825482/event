"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DRAFT_INTERVAL_MS,
  clearDraft,
  draftKey,
  parseDraft,
  writeDraft,
  type DraftStorage,
  type StoredDraft,
} from "../editor/draft";
import type { EditorStore } from "../editor/store";

type Options = { store: EditorStore; eventId: string; userId: string; enabled: boolean };

export type LayoutDraft = {
  /** Açılışta bulunan, henüz karar verilmemiş taslak (kurtarma penceresi için). */
  recovery: StoredDraft | null;
  restore: () => void;
  discard: () => void;
  /** Son otomatik taslak kaydının zamanı (ISO). */
  lastSavedAt: string | null;
  /** Başarılı kayıt / şablon uygulama sonrası taslağı siler. */
  clear: () => void;
};

function storage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/**
 * Yerleşim taslağı: değişiklik varken 30 sn'de bir ve sayfa kapanırken (`pagehide`) localStorage'a yazar;
 * açılışta bulunan taslak için kurtarma penceresi verisi döner. Anahtar etkinlik + kullanıcı başınadır.
 */
export function useLayoutDraft({ store, eventId, userId, enabled }: Options): LayoutDraft {
  const key = draftKey(eventId, userId);
  // Yalnızca ilk okuma kurtarma için kullanılır; sonraki otomatik kayıtlar pencereyi yeniden açmaz.
  const initial = useRef<{ key: string; raw: string | null } | null>(null);
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      if (initial.current?.key !== key) initial.current = { key, raw: readRaw(key) };
      return initial.current.raw;
    },
    () => null,
  );
  const [decided, setDecided] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const found = useMemo(() => (enabled ? parseDraft(raw, eventId, userId) : null), [enabled, raw, eventId, userId]);
  const recovery = decided ? null : found;
  const waiting = useRef(false);

  useEffect(() => {
    waiting.current = recovery !== null;
  }, [recovery]);

  useEffect(() => {
    if (!enabled) return;
    const save = () => {
      const s = store.getState();
      // Kurtarma kararı verilmeden yazmak bulunan taslağın üzerine yazardı.
      if (!s.dirty || waiting.current) return;
      const now = new Date();
      if (writeDraft(storage(), eventId, userId, { tables: s.tables, elements: s.elements, lines: s.lines, canvas: s.canvas }, now)) {
        setLastSavedAt(now.toISOString());
      }
    };
    const timer = window.setInterval(save, DRAFT_INTERVAL_MS);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [enabled, store, eventId, userId]);

  const restore = useCallback(() => {
    if (found) {
      store.getState().restoreDraft(found.content);
      setLastSavedAt(found.savedAt);
    }
    setDecided(true);
  }, [found, store]);

  const discard = useCallback(() => {
    clearDraft(storage(), eventId, userId);
    setDecided(true);
  }, [eventId, userId]);

  const clear = useCallback(() => {
    clearDraft(storage(), eventId, userId);
    setLastSavedAt(null);
    setDecided(true);
  }, [eventId, userId]);

  return { recovery, restore, discard, lastSavedAt, clear };
}
