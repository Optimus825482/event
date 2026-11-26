import { z } from "zod";

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) => (value ? value : null))
    .optional();

const fields = {
  name: z.string().trim().min(1, "Sanatçı adı gerekli").max(200, "Sanatçı adı en fazla 200 karakter olabilir"),
  genre: optionalText(100, "Tür en fazla 100 karakter olabilir"),
  notes: optionalText(2000, "Not en fazla 2000 karakter olabilir"),
};

export const createArtistSchema = z.object(fields);
export type CreateArtistInput = z.infer<typeof createArtistSchema>;

export const updateArtistSchema = z.object({
  id: z.uuid("Geçersiz sanatçı"),
  ...fields,
  isActive: z.boolean().optional(),
});
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>;

export const deleteArtistSchema = z.object({ id: z.uuid("Geçersiz sanatçı") });
export type DeleteArtistInput = z.infer<typeof deleteArtistSchema>;
