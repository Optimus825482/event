import { z } from "zod";
import { COEFFICIENT_PATTERN, fromMinor, MONEY_PATTERN, toMilli, toMinor } from "./money";

const coefficient = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!COEFFICIENT_PATTERN.test(value)) {
      ctx.addIssue({ code: "custom", message: "Katsayı geçersiz" });
    } else if (toMilli(value) <= BigInt(0)) {
      ctx.addIssue({ code: "custom", message: "Katsayı 0'dan büyük olmalı" });
    }
  });

export const coefficientsSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  coefficients: z.strictObject({ standard: coefficient, premium: coefficient, vip: coefficient }),
});
export type CoefficientsInput = z.infer<typeof coefficientsSchema>;

const price = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!MONEY_PATTERN.test(value)) {
      ctx.addIssue({ code: "custom", message: "Tutar geçersiz" });
    } else if (toMinor(value) <= BigInt(0)) {
      ctx.addIssue({ code: "custom", message: "Fiyat 0'dan büyük olmalı" });
    }
  })
  .transform((value) => (MONEY_PATTERN.test(value) ? fromMinor(toMinor(value)) : value));

export const finalPricesSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  prices: z
    .strictObject({ standard: price.optional(), premium: price.optional(), vip: price.optional() })
    .refine((prices) => Object.values(prices).some((v) => v !== undefined), { message: "En az bir fiyat girin" }),
});
export type FinalPricesInput = { eventId: string; prices: Partial<Record<"standard" | "premium" | "vip", string>> };
