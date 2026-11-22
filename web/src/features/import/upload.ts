import { z } from "zod";
import { DomainError } from "@/lib/action";
import { MAX_FILE_BYTES } from "./limits";

/** Sunucu eylemi girdisi: `FormData` (alanlar `eventId`, `file`) ya da düz nesne. */
function fromFormData(raw: unknown): unknown {
  return raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw;
}

export const importUploadInput = z.preprocess(
  fromFormData,
  z.object({
    eventId: z.uuid("Geçersiz etkinlik kimliği"),
    file: z.instanceof(File, { error: "Dosya seçiniz" }),
  }),
);

/** Yükleneni belleğe almadan önce boyutu denetler; asıl içerik denetimi `readFirstSheet`tedir. */
export async function readUpload(file: File): Promise<Uint8Array> {
  if (file.size > MAX_FILE_BYTES) {
    throw new DomainError("invalid", `Dosya ${MAX_FILE_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
  }
  return new Uint8Array(await file.arrayBuffer());
}
