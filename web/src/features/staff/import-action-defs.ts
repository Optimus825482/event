import { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { DomainError } from "@/lib/action";
import { STAFF_IMPORT_MAX_BYTES } from "./csv-import";
import { importStaffCsv, previewStaffImport } from "./import-service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** Girdi: `FormData` (`file` alanı) ya da `{ file }` nesnesi. */
const csvUploadInput = z.preprocess(
  (raw) => (raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw),
  z.object({ file: z.instanceof(File, { error: "CSV dosyası seçin" }) }),
);

/** Boyutu belleğe almadan önce denetler; kodlama ve içerik denetimi `import-service.ts`tedir. */
async function readCsvUpload(file: File): Promise<Uint8Array> {
  if (file.size > STAFF_IMPORT_MAX_BYTES) {
    throw new DomainError("invalid", `Dosya ${STAFF_IMPORT_MAX_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
  }
  return new Uint8Array(await file.arrayBuffer());
}

/** Önizleme de bir action'dır ama yazmaz; ikisi de `staff.create` ister (servis yineler). */
export const staffImportActionDefs = {
  preview: def({
    module: "staff",
    verb: "create",
    input: csvUploadInput,
    handler: async ({ actor, input, db }) => previewStaffImport(db, actor, { bytes: await readCsvUpload(input.file) }),
  }),
  run: def({
    module: "staff",
    verb: "create",
    input: csvUploadInput,
    handler: async ({ actor, input, db }) => importStaffCsv(db, actor, { bytes: await readCsvUpload(input.file) }),
  }),
};
