import type { PlanModel } from "./model";
import { quantityOptions, type QuantityRules } from "./quantity";

export type Selection = { tableId: string; quantity: number };

export const TABLE_GONE_NOTICE = "Seçtiğiniz masa doldu. Lütfen başka bir masa seçin.";
export const QUANTITY_CHANGED_NOTICE = "Masa durumu değişti; adet güncellendi.";

/** Masanın geçerli adetleri; masa alınamıyorsa boş. */
export function optionsFor(model: PlanModel, tableId: string, rules: QuantityRules): number[] {
  const table = model.tables.find((t) => t.id === tableId);
  if (!table || table.status !== "available" || table.free === null || table.seats === null) return [];
  return quantityOptions({ free: table.free, seats: table.seats, wholeOnly: table.wholeOnly }, rules);
}

/** Canlı durum değişince seçimi geçerli tutar; değişiklik yoksa aynı nesneyi ve `null` bildirimi döndürür. */
export function reconcileSelection(
  selection: Selection | null,
  model: PlanModel,
  rules: QuantityRules,
): { selection: Selection | null; notice: string | null } {
  if (selection === null) return { selection, notice: null };
  const options = optionsFor(model, selection.tableId, rules);
  if (options.length === 0) return { selection: null, notice: TABLE_GONE_NOTICE };
  if (options.includes(selection.quantity)) return { selection, notice: null };
  const smaller = options.filter((q) => q < selection.quantity);
  const quantity = smaller.length > 0 ? Math.max(...smaller) : Math.min(...options);
  return { selection: { tableId: selection.tableId, quantity }, notice: QUANTITY_CHANGED_NOTICE };
}
