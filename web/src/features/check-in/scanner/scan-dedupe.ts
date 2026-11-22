/**
 * Kamera aynı QR'ı saniyede onlarca kez okur. Bir kod kabul edildikten sonra `windowMs` boyunca
 * aynı kodun okumaları yok sayılır; reddedilen okumalar pencereyi UZATMAZ (kodu kameranın önünde
 * tutmaya devam eden operatör, pencere dolunca yeniden okutabilir).
 */
export type ScanDeduper = {
  accept(code: string, now: number): boolean;
  reset(): void;
};

export const DEFAULT_DEDUPE_WINDOW_MS = 4_000;

export function createScanDeduper(windowMs: number = DEFAULT_DEDUPE_WINDOW_MS): ScanDeduper {
  const accepted = new Map<string, number>();
  return {
    accept(code, now) {
      const key = code.trim();
      if (key === "") return false;
      for (const [seen, at] of accepted) if (now - at >= windowMs) accepted.delete(seen);
      if (accepted.has(key)) return false;
      accepted.set(key, now);
      return true;
    },
    reset() {
      accepted.clear();
    },
  };
}
