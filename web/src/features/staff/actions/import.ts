"use server";

import { defineAction } from "@/lib/action";
import { staffImportActionDefs } from "../import-action-defs";

export const previewStaffImportAction = defineAction(staffImportActionDefs.preview);
export const importStaffCsvAction = defineAction(staffImportActionDefs.run);
