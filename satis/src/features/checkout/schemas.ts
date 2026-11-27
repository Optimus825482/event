import { z } from "zod";
import { createOrderBodySchema } from "@/lib/core/contract";

// Sözleşme şemasından türetilir: küçük harfe indirgeme (UUID) ve sınırlar tek yerde kalır.
export const holdInputSchema = createOrderBodySchema;

const required = (message: string) => z.string({ error: message }).trim().min(1, message);

export const buyerSchema = z.strictObject({
  firstName: required("Ad gerekli").max(100, "Ad en fazla 100 karakter olabilir"),
  lastName: required("Soyad gerekli").max(100, "Soyad en fazla 100 karakter olabilir"),
  email: z
    .string({ error: "Geçerli bir e-posta girin" })
    .trim()
    .pipe(z.email({ error: "Geçerli bir e-posta girin" }).max(254, "Geçerli bir e-posta girin")),
  phone: z
    .string()
    .trim()
    .max(30, "Telefon en fazla 30 karakter olabilir")
    .optional()
    .transform((value) => (value ? value : undefined)),
  acceptTerms: z.literal(true, { error: "Devam etmek için metinleri onaylamalısınız" }),
});
