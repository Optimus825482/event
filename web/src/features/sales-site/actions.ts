"use server";

import { defineAction } from "@/lib/action";
import { salesSiteActionDefs } from "./action-defs";

export const saveSiteContentAction = defineAction(salesSiteActionDefs.saveContent);
export const uploadSiteImageAction = defineAction(salesSiteActionDefs.uploadImage);
export const removeSiteImageAction = defineAction(salesSiteActionDefs.removeImage);
