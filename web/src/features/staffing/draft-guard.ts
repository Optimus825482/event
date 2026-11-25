/**
 * Sihirbaz taslağı kaydedilmemişken sunucuya doğrudan yazan eylemler (loca gruplama, kısım sorumluları)
 * engellenir: eylem sonrası yenileme taslağı sıfırlar, atlanırsa sonraki "Tümünü kaydet" yeni kayıtları siler.
 */
export const DRAFT_DIRTY_NOTE = "Kaydedilmemiş değişiklikler var: önce \"Tümünü kaydet\" ile kaydedin ya da geri alın.";

export function draftWriteBlock(dirty: boolean): { blocked: boolean; note: string | null } {
  return dirty ? { blocked: true, note: DRAFT_DIRTY_NOTE } : { blocked: false, note: null };
}
