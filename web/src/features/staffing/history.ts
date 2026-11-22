/**
 * Sihirbaz taslağı için geri al / yinele geçmişi (saf, depodan bağımsız).
 *
 * Her değişiklikten önce mevcut anlık görüntü `past` yığınına itilir ve `future` temizlenir.
 * Aynı `key` ile art arda gelen değişiklikler (ör. bir alana harf harf yazmak) tek adımda birleşir.
 */
export type History<T> = {
  past: T[];
  future: T[];
  /** Son kaydın birleştirme anahtarı; geri al / yinele ve anahtarsız değişiklik bunu sıfırlar. */
  lastKey: string | null;
  /** Sınır yüzünden en eski kayıt atıldı mı (geçmiş boşalsa da taslak ilk halinden farklıdır). */
  trimmed: boolean;
};

export const HISTORY_LIMIT = 50;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [], lastKey: null, trimmed: false };
}

/** Değişiklikten önceki anlık görüntüyü kaydeder. */
export function record<T>(history: History<T>, snapshot: T, key: string | null = null, limit = HISTORY_LIMIT): History<T> {
  if (key !== null && key === history.lastKey && history.past.length > 0) {
    return { ...history, future: [] };
  }
  const past = [...history.past, snapshot];
  const overflow = Math.max(0, past.length - limit);
  return {
    past: overflow > 0 ? past.slice(overflow) : past,
    future: [],
    lastKey: key,
    trimmed: history.trimmed || overflow > 0,
  };
}

/** Bir adım geri: önceki görüntüyü döndürür, mevcut olan `future` başına geçer. */
export function undo<T>(history: History<T>, current: T): { history: History<T>; snapshot: T } | null {
  const snapshot = history.past.at(-1);
  if (snapshot === undefined) return null;
  return {
    snapshot,
    history: { ...history, past: history.past.slice(0, -1), future: [current, ...history.future], lastKey: null },
  };
}

/** Bir adım ileri. */
export function redo<T>(history: History<T>, current: T): { history: History<T>; snapshot: T } | null {
  const [snapshot, ...future] = history.future;
  if (snapshot === undefined) return null;
  return { snapshot, history: { ...history, past: [...history.past, current], future, lastKey: null } };
}

/** Geçmiş varsa ya da kırpıldıysa taslak kayıtlı durumdan farklıdır. */
export function isDirty<T>(history: History<T>): boolean {
  return history.past.length > 0 || history.trimmed;
}

type KeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** Odaktaki öğe metin alanıysa tarayıcının kendi geri alması çalışmalı. */
  inTextField: boolean;
};

/** Ctrl/Cmd+Z geri al; Ctrl/Cmd+Y ve Ctrl/Cmd+Shift+Z yinele. Metin alanında ve Alt ile kısayol yok. */
export function historyShortcut(e: KeyLike): "undo" | "redo" | null {
  if (e.inTextField || e.altKey || !(e.ctrlKey || e.metaKey)) return null;
  const k = e.key.toLowerCase();
  if (k === "z") return e.shiftKey ? "redo" : "undo";
  if (k === "y" && !e.shiftKey) return "redo";
  return null;
}
