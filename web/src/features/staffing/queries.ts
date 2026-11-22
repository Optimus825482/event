import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, can } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getOrganization } from "./organization-service";
import { listOrganizationTemplates } from "./templates-service";

/** Ekip organizasyonu sayfası verisi. Kimlik geçersizse ya da etkinlik görünmüyorsa 404. */
export async function loadTeamOrganization(id: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  if (!isUuid(id)) notFound();
  try {
    const [organization, templates] = await Promise.all([
      getOrganization(db, actor, id),
      listOrganizationTemplates(db, actor),
    ]);
    return {
      organization,
      templates: templates.map((t) => ({ id: t.id, name: t.name, description: t.description, isDefault: t.isDefault, canManage: t.canManage })),
      canImport: can(actor, "events", "edit"),
      permissions: {
        edit: can(actor, "events", "edit") && organization.editable,
        createTemplate: can(actor, "events", "create"),
        deleteTemplate: can(actor, "events", "delete"),
      },
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

export type TeamOrganizationData = Awaited<ReturnType<typeof loadTeamOrganization>>;
