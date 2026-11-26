export type QuantityTable = { free: number; seats: number; wholeOnly: boolean };
export type QuantityRules = { maxSeatsPerOrder: number; blockSingleLeftover: boolean };

/** Masadan alınabilecek geçerli adetler (artan sırada). */
export function quantityOptions(table: QuantityTable, rules: QuantityRules): number[] {
  const { free, seats, wholeOnly } = table;
  if (wholeOnly) return free === seats && seats <= rules.maxSeatsPerOrder ? [seats] : [];
  const top = Math.min(free, rules.maxSeatsPerOrder);
  const options: number[] = [];
  for (let q = 1; q <= top; q++) {
    if (rules.blockSingleLeftover && free - q === 1) continue;
    options.push(q);
  }
  return options;
}
