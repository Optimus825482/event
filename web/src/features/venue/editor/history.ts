export const HISTORY_LIMIT = 50;

export type History<T> = { past: T[]; future: T[] };

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Değişiklikten önceki durumu geçmişe ekler; ileri yığını boşalır. En eski kayıtlar sınırda düşer. */
export function record<T>(history: History<T>, current: T, limit = HISTORY_LIMIT): History<T> {
  const past = [...history.past, current];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

/** Geri al: önceki durumu döner, mevcut durum ileri yığınına girer. Geri alınacak yoksa `null`. */
export function undo<T>(history: History<T>, current: T): { history: History<T>; state: T } | null {
  const state = history.past[history.past.length - 1];
  if (state === undefined) return null;
  return { history: { past: history.past.slice(0, -1), future: [current, ...history.future] }, state };
}

/** Yinele: ileri yığınındaki ilk durumu döner. Yinelenecek yoksa `null`. */
export function redo<T>(history: History<T>, current: T): { history: History<T>; state: T } | null {
  const [state, ...rest] = history.future;
  if (state === undefined) return null;
  return { history: { past: [...history.past, current], future: rest }, state };
}
