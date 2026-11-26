"use server";

import { defineAction } from "@/lib/action";
import { artistActionDefs } from "./action-defs";

export const createArtistAction = defineAction(artistActionDefs.create);
export const updateArtistAction = defineAction(artistActionDefs.update);
export const deleteArtistAction = defineAction(artistActionDefs.remove);
export const listArtistOptionsAction = defineAction(artistActionDefs.options);
