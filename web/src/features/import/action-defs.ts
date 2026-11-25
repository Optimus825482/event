import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { importAssignments, previewAssignmentImport } from "./assignments-import";
import { importReservations, previewReservationImport } from "./reservations-import";
import { importUploadInput, readUpload } from "./upload";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * Önizleme de bir action'dır (oturum + izin + girdi doğrulaması tek yerde) ama veritabanına yazmaz.
 * Rezervasyon içe aktarma `reservations.create`, atama içe aktarma ekip organizasyonu kaydıyla aynı
 * `staff.edit` iznini ister. Servisler ikinci savunma olarak aynı denetimi yineler.
 */
export const importActionDefs = {
  previewReservations: def({
    module: "reservations",
    verb: "create",
    input: importUploadInput,
    handler: async ({ actor, input, db }) =>
      previewReservationImport(db, actor, { eventId: input.eventId, bytes: await readUpload(input.file) }),
  }),
  importReservations: def({
    module: "reservations",
    verb: "create",
    input: importUploadInput,
    handler: async ({ actor, input, db }) =>
      importReservations(db, actor, { eventId: input.eventId, bytes: await readUpload(input.file) }),
  }),
  previewAssignments: def({
    module: "staff",
    verb: "edit",
    input: importUploadInput,
    handler: async ({ actor, input, db }) =>
      previewAssignmentImport(db, actor, { eventId: input.eventId, bytes: await readUpload(input.file) }),
  }),
  importAssignments: def({
    module: "staff",
    verb: "edit",
    input: importUploadInput,
    handler: async ({ actor, input, db }) =>
      importAssignments(db, actor, { eventId: input.eventId, bytes: await readUpload(input.file) }),
  }),
};
