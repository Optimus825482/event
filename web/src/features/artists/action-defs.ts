import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { z } from "zod";
import { createArtistSchema, deleteArtistSchema, updateArtistSchema } from "./schemas";
import { listArtistOptions } from "./resolve";
import { createArtist, deleteArtist, updateArtist } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; `actions.ts` bunları sarmalar, testler aynı tanımları oturumsuz çalıştırır. */
export const artistActionDefs = {
  create: def({
    module: "archive",
    verb: "create",
    input: createArtistSchema,
    handler: async ({ actor, input }) => ({ id: (await createArtist(db, actor, input)).id }),
  }),
  update: def({
    module: "archive",
    verb: "edit",
    input: updateArtistSchema,
    handler: async ({ actor, input }) => ({ id: (await updateArtist(db, actor, input)).id }),
  }),
  remove: def({
    module: "archive",
    verb: "delete",
    input: deleteArtistSchema,
    handler: async ({ actor, input }) => deleteArtist(db, actor, input),
  }),
  /** Etkinlik formunun sanatçı önerileri: yalnızca kimlik ve ad (tam kayıt `archive:view` ister). */
  options: def({
    module: "events",
    verb: "view",
    input: z.object({}),
    handler: async () => listArtistOptions(db),
  }),
};
