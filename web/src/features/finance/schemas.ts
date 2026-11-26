import { z } from "zod";
import { CASINO_COST_MODES, CATEGORIES_BY_DIRECTION, FINANCE_CATEGORIES, FINANCE_DIRECTIONS } from "./constants";
import { fromMinor, MONEY_PATTERN, toMinor } from "./money";

const CATEGORY_MISMATCH = "Bu kategori seçilen yön için geçerli değil";

/** Tutar girdisi: en fazla 9 tam basamak, 2 ondalık; çıktı her zaman 2 ondalıklı kanonik dizge. */
export const moneyAmount = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, "Tutar geçersiz")
  .transform((value) => fromMinor(toMinor(value)));

const category = z.enum(FINANCE_CATEGORIES, { error: "Geçersiz kategori" });
const label = z.string().trim().min(1, "Kalem adı gerekli").max(120, "Kalem adı en fazla 120 karakter olabilir");
const note = z
  .string()
  .trim()
  .max(500, "Not en fazla 500 karakter olabilir")
  .nullish()
  .transform((value) => (value ? value : null));

export const createFinanceItemSchema = z
  .object({
    eventId: z.uuid("Geçersiz etkinlik"),
    direction: z.enum(FINANCE_DIRECTIONS, { error: "Geçersiz yön" }),
    category,
    label,
    estimatedAmount: moneyAmount,
    actualAmount: moneyAmount.nullable(),
    note,
  })
  .superRefine((value, ctx) => {
    if (!CATEGORIES_BY_DIRECTION[value.direction].includes(value.category)) {
      ctx.addIssue({ code: "custom", message: CATEGORY_MISMATCH, path: ["category"] });
    }
  });
export type CreateFinanceItemInput = z.infer<typeof createFinanceItemSchema>;

export const updateFinanceItemSchema = z.object({
  id: z.uuid("Geçersiz kalem"),
  category,
  label,
  estimatedAmount: moneyAmount,
  actualAmount: moneyAmount.nullable(),
  note,
});
export type UpdateFinanceItemInput = z.infer<typeof updateFinanceItemSchema>;

export const deleteFinanceItemSchema = z.object({ id: z.uuid("Geçersiz kalem") });

export const financePlanSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  targetProfit: moneyAmount,
  casinoCostMode: z.enum(CASINO_COST_MODES, { error: "Geçersiz Casino payı seçeneği" }),
  casinoTransferPrice: moneyAmount,
});
export type FinancePlanInput = z.infer<typeof financePlanSchema>;
