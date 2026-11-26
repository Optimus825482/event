import type { VenueLayout } from "../service";

/**
 * Satış başladıktan sonra yerleşim kilidinin editördeki görünümü. Yetkili olan sunucudur
 * (`findLockedChanges`); editör yalnızca kullanıcıyı önceden bilgilendirir ve geçersiz işlemleri engeller.
 */
export type EditorLock = { locked: boolean; frozen: ReadonlySet<string> };

/** Donmuş masanın imleç ipucu ve panel notu. */
export const FROZEN_TABLE_TITLE = "Taahhütlü (rezervasyonlu) masa: konumu ve etiketi değiştirilemez";

export const NO_LOCK: EditorLock = { locked: false, frozen: new Set() };

/** Donmuş masaların sırasına güvenilmez; küme olarak tutulur. */
export function editorLock(layout: Pick<VenueLayout, "layoutLocked" | "frozenTableIds">): EditorLock {
  return { locked: layout.layoutLocked, frozen: layout.layoutLocked ? new Set(layout.frozenTableIds) : new Set() };
}

export function isFrozen(lock: EditorLock, tableId: string): boolean {
  return lock.frozen.has(tableId);
}

/** Silinecek masa kimliklerini silinebilir ve donmuş (engellenen) olarak ayırır; göreli sıra korunur. */
export function partitionDeletion(lock: EditorLock, ids: readonly string[]): { allowed: string[]; blocked: string[] } {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const id of ids) (isFrozen(lock, id) ? blocked : allowed).push(id);
  return { allowed, blocked };
}

type TableRef = { key: string; id?: string | null; isPinned: boolean };

/** Taşıma/hizalama için: sabitlenmiş veya donmuş masalar çıkarılır; masa olmayan anahtarlar (dekor) korunur. */
export function movableKeys(lock: EditorLock, tables: readonly TableRef[], keys: readonly string[]): string[] {
  const byKey = new Map(tables.map((t) => [t.key, t]));
  return keys.filter((k) => {
    const t = byKey.get(k);
    return !t || !(t.isPinned || (t.id != null && isFrozen(lock, t.id)));
  });
}
