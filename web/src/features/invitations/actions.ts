"use server";

import { defineAction } from "@/lib/action";
import { invitationActionDefs } from "./action-defs";

export const createTemplateAction = defineAction(invitationActionDefs.createTemplate);
export const updateTemplateAction = defineAction(invitationActionDefs.updateTemplate);
export const deleteTemplateAction = defineAction(invitationActionDefs.deleteTemplate);
export const setDefaultTemplateAction = defineAction(invitationActionDefs.setDefaultTemplate);
export const saveEventInvitationAction = defineAction(invitationActionDefs.saveEventInvitation);
export const uploadInvitationImageAction = defineAction(invitationActionDefs.uploadImage);
export const removeInvitationImageAction = defineAction(invitationActionDefs.removeImage);
export const sendInvitationEmailAction = defineAction(invitationActionDefs.sendEmail);
export const whatsappLinkAction = defineAction(invitationActionDefs.whatsappLink);
