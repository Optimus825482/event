/** 3B balo salonu sahnesinin yardımcı yerleşim hesapları (three.js'e bağımlı değildir). */

/** Avizeler: salonun genişliği boyunca eşit aralıklı, en fazla üç adet. */
export function chandelierPositions(width: number): number[] {
  if (width < 8) return [0];
  if (width < 20) return [-width / 4, width / 4];
  return [-width / 3.2, 0, width / 3.2];
}
