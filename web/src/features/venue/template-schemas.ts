import { z } from "zod";

const name = z
  .string({ error: "Şablon adı gerekli" })
  .trim()
  .min(1, "Şablon adı gerekli")
  .max(120, "Şablon adı en fazla 120 karakter olabilir");

const description = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(1000, "Açıklama en fazla 1000 karakter olabilir").optional(),
);

/** Kütüphaneden masasız (boş) şablon oluşturma. Masalar sonradan bir etkinlikten kaydedilir. */
export const createBlankTemplateSchema = z.object({
  name,
  description,
  isPublic: z.boolean().default(false),
});
export type CreateBlankTemplateInput = Omit<z.output<typeof createBlankTemplateSchema>, "isPublic"> & {
  isPublic?: boolean;
};
