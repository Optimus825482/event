import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { getEventInvitationDetail, listRecipients } from "./event-invitation";
import { getTemplate, listTemplates } from "./templates";
import { isUuid } from "@/lib/identifiers";

async function orNotFound<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

export async function loadTemplates() {
  const actor = await requirePolicyActor();
  authorize(actor, "invitations", "view");
  return listTemplates(db, actor);
}

export async function loadTemplate(id: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "invitations", "view");
  if (!isUuid(id)) notFound();
  return orNotFound(() => getTemplate(db, actor, id));
}

/** Etkinlik davetiye sayfası verisi: düzen, şablon listesi ve gönderim alıcıları. */
export async function loadEventInvitationPage(eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "invitations", "view");
  if (!isUuid(eventId)) notFound();
  return orNotFound(async () => {
    const [detail, templates, recipients] = await Promise.all([
      getEventInvitationDetail(db, actor, { eventId }),
      listTemplates(db, actor),
      listRecipients(db, actor, { eventId }),
    ]);
    return { ...detail, templates, recipients };
  });
}
