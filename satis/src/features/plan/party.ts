export const PARTY_PARAM = "kisi";
export const DEFAULT_PARTY_SIZE = 2;

/** `1..max` aralığında tam sayı dizgisi ise kişi sayısını, değilse `undefined` döndürür. */
export function parsePartySize(raw: string | string[] | undefined, max: number): number | undefined {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) return undefined;
  return parsed;
}
