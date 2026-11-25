import type { z } from "zod";
import { db } from "@/db/client";
import { withPermissions } from "@/features/auth/permissions";
import { authorize } from "@/features/auth/policy";
import type { ActionOptions } from "@/lib/action";
import {
  applyTemplateSchema,
  createTableTypeSchema,
  saveAsTemplateSchema,
  saveLayoutSchema,
  tableTypeIdSchema,
  templateIdSchema,
  updateTableTypeSchema,
  updateTemplateSchema,
} from "./schemas";
import { applyVenueTemplate, saveAsTemplate, saveLayout } from "./service";
import { createTableType, deleteTableType, updateTableType } from "./table-types-service";
import { createBlankTemplateSchema } from "./template-schemas";
import {
  createBlankTemplate,
  deleteVenueTemplate,
  duplicateVenueTemplate,
  templateOwnerResource,
  updateVenueTemplate,
} from "./templates-service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * `defineAction` seçenekleri; `actions.ts` bunları sarmalar, testler aynı tanımları
 * oturumsuz `createAction` ile çalıştırır.
 */
export const venueActionDefs = {
  saveLayout: def({
    module: "venues",
    verb: "edit",
    input: saveLayoutSchema,
    handler: async ({ actor, input }) => saveLayout(db, actor, input),
  }),
  applyTemplate: def({
    module: "venues",
    verb: "edit",
    input: applyTemplateSchema,
    handler: async ({ actor, input }) => applyVenueTemplate(db, actor, input),
  }),
  saveAsTemplate: def({
    module: "venues",
    verb: "create",
    input: saveAsTemplateSchema,
    handler: async ({ actor, input }) => {
      // Kaynak etkinliği okuyabilmek de gerekir (örn. mekân sahibi rolü etkinlik göremez).
      authorize(await withPermissions(actor), "events", "view");
      const row = await saveAsTemplate(db, actor, input);
      return { id: row.id, name: row.name };
    },
  }),
  updateTemplate: def({
    module: "venues",
    verb: "edit",
    input: updateTemplateSchema,
    resource: ({ input }) => templateOwnerResource(db, input.id),
    handler: async ({ actor, input }) => {
      const row = await updateVenueTemplate(db, actor, input);
      return { id: row.id };
    },
  }),
  deleteTemplate: def({
    module: "venues",
    verb: "delete",
    input: templateIdSchema,
    resource: ({ input }) => templateOwnerResource(db, input.id),
    handler: async ({ actor, input }) => deleteVenueTemplate(db, actor, input),
  }),
  duplicateTemplate: def({
    module: "venues",
    verb: "create",
    input: templateIdSchema,
    handler: async ({ actor, input }) => {
      const row = await duplicateVenueTemplate(db, actor, input);
      return { id: row.id };
    },
  }),
  createBlankTemplate: def({
    module: "venues",
    verb: "create",
    input: createBlankTemplateSchema,
    handler: async ({ actor, input }) => {
      const row = await createBlankTemplate(db, actor, input);
      return { id: row.id, name: row.name };
    },
  }),
  createTableType: def({
    module: "settings",
    verb: "create",
    input: createTableTypeSchema,
    handler: async ({ input }) => {
      const row = await createTableType(db, input);
      return { id: row.id };
    },
  }),
  updateTableType: def({
    module: "settings",
    verb: "edit",
    input: updateTableTypeSchema,
    handler: async ({ input }) => {
      const row = await updateTableType(db, input);
      return { id: row.id };
    },
  }),
  deleteTableType: def({
    module: "settings",
    verb: "delete",
    input: tableTypeIdSchema,
    handler: async ({ input }) => deleteTableType(db, input),
  }),
};
